// jazzlineup.com infrastructure:
//
//   EventBridge (every 4h) ──▶ Lambda (crawler) ──▶ S3 ◀── CloudFront ◀── visitors
//                                                    ▲
//                                    web/dist (built frontend, deployed by CDK)
//
// DNS lives at Cloudflare (see DEPLOY.md): a CNAME points jazzlineup.com at
// the CloudFront domain, and the ACM certificate is validated by a CNAME too.
const path = require('node:path');
const cdk = require('aws-cdk-lib');
const s3 = require('aws-cdk-lib/aws-s3');
const s3deploy = require('aws-cdk-lib/aws-s3-deployment');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const acm = require('aws-cdk-lib/aws-certificatemanager');
const lambda = require('aws-cdk-lib/aws-lambda');
const events = require('aws-cdk-lib/aws-events');
const targets = require('aws-cdk-lib/aws-events-targets');
const logs = require('aws-cdk-lib/aws-logs');
const cloudwatch = require('aws-cdk-lib/aws-cloudwatch');
const iam = require('aws-cdk-lib/aws-iam');
const cwActions = require('aws-cdk-lib/aws-cloudwatch-actions');
const sns = require('aws-cdk-lib/aws-sns');
const snsSubs = require('aws-cdk-lib/aws-sns-subscriptions');
const budgets = require('aws-cdk-lib/aws-budgets');
const { Construct } = require('constructs');

const DOMAIN = 'jazzlineup.com';
const ALERT_EMAIL = 'zachbclark@gmail.com'; // SNS sends a confirm link on first deploy

class JazzLineupStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // --- S3: one private bucket for the site build + events.json ------------
    const bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // personal project: cdk destroy cleans up
      autoDeleteObjects: true,
    });

    // --- TLS certificate (validated via a CNAME you add at Cloudflare) ------
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: DOMAIN,
      subjectAlternativeNames: [`www.${DOMAIN}`],
      validation: acm.CertificateValidation.fromDns(), // manual DNS validation
    });

    // --- CloudFront access logs (the raw "network traffic" record) ----------
    // Standard logs: one gzipped file per batch of requests — IP, path, status,
    // bytes, referrer, user-agent. Costs pennies; expires after 90 days.
    const logBucket = new s3.Bucket(this, 'AccessLogBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED, // CloudFront logs need ACLs
      lifecycleRules: [{ expiration: cdk.Duration.days(90) }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- Security headers (HSTS, no-sniff, frame-deny, referrer policy) ------
    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    });

    // --- CloudFront ----------------------------------------------------------
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      enableLogging: true,
      logBucket,
      logFilePrefix: 'cf/',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        responseHeadersPolicy: securityHeaders,
        // CACHING_OPTIMIZED honors origin Cache-Control headers; the crawler
        // writes events.json with max-age=300 so data refreshes within 5 min.
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      domainNames: [DOMAIN, `www.${DOMAIN}`],
      certificate,
      errorResponses: [
        // SPA-style fallback: unknown paths serve the app shell.
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.minutes(1) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.minutes(1) },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // NA + EU edges: cheapest
    });

    // --- Frontend deployment (web/dist must be built before `cdk deploy`) ---
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '..', '..', 'web', 'dist'))],
      destinationBucket: bucket,
      distribution,               // invalidate CloudFront cache on deploy
      distributionPaths: ['/*'],
      prune: false,               // NEVER delete events.json on redeploys
    });

    // --- Crawler Lambda -------------------------------------------------------
    const crawler = new lambda.Function(this, 'Crawler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'crawler')),
      timeout: cdk.Duration.minutes(3),
      memorySize: 512,
      environment: { BUCKET: bucket.bucketName },
      logRetention: logs.RetentionDays.TWO_WEEKS,
      description: 'Crawls NYC jazz club sites and writes events.json to S3',
    });
    bucket.grantReadWrite(crawler);
    // the crawler emits a per-run "ProblemClubs" drift metric
    crawler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: { StringEquals: { 'cloudwatch:namespace': 'JazzLineup' } },
    }));

    // --- Schedule: every 4 hours ---------------------------------------------
    new events.Rule(this, 'CrawlSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(4)),
      targets: [new targets.LambdaFunction(crawler, { retryAttempts: 1 })],
    });

    // --- Monitoring: dashboard + email alarms --------------------------------
    // Free tier covers all of this (3 dashboards, 10 alarms, email SNS).
    const alerts = new sns.Topic(this, 'Alerts', { displayName: 'jazzlineup alerts' });
    alerts.addSubscription(new snsSubs.EmailSubscription(ALERT_EMAIL));

    // Crawler failed twice in a row (~8h of stale data) -> email.
    const crawlerErrors = crawler.metricErrors({ period: cdk.Duration.hours(4), statistic: 'Sum' });
    const crawlerAlarm = new cloudwatch.Alarm(this, 'CrawlerFailing', {
      metric: crawlerErrors,
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'jazzlineup crawler Lambda errored on 2 consecutive runs',
    });
    crawlerAlarm.addAlarmAction(new cwActions.SnsAction(alerts));

    // Site serving errors: >5% of requests 5xx for 15 min -> email.
    const cfError5xx = distribution.metric5xxErrorRate({ period: cdk.Duration.minutes(5), statistic: 'Average' });
    const siteAlarm = new cloudwatch.Alarm(this, 'SiteErrors', {
      metric: cfError5xx,
      threshold: 5,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'jazzlineup.com is serving >5% 5xx responses',
    });
    siteAlarm.addAlarmAction(new cwActions.SnsAction(alerts));

    // A single club rotting for ~24h (6 crawls) -> email. Which club is in
    // the Lambda logs; this only says "go look".
    const problemClubs = new cloudwatch.Metric({
      namespace: 'JazzLineup',
      metricName: 'ProblemClubs',
      period: cdk.Duration.hours(4),
      statistic: 'Maximum',
    });
    const driftAlarm = new cloudwatch.Alarm(this, 'ClubDrift', {
      metric: problemClubs,
      threshold: 1,
      evaluationPeriods: 6,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'A jazzlineup club crawler has been suspect/failing for ~24h — check the crawler logs for which venue',
    });
    driftAlarm.addAlarmAction(new cwActions.SnsAction(alerts));

    // One dashboard: visitor traffic on top, crawler health below.
    const dash = new cloudwatch.Dashboard(this, 'Dashboard', { dashboardName: 'jazzlineup' });
    dash.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Requests (visitors hitting the site)',
        left: [distribution.metricRequests({ period: cdk.Duration.hours(1), statistic: 'Sum' })],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Bytes served',
        left: [distribution.metricBytesDownloaded({ period: cdk.Duration.hours(1), statistic: 'Sum' })],
        width: 12,
      }),
    );
    dash.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Error rates (%)',
        left: [
          distribution.metric4xxErrorRate({ period: cdk.Duration.hours(1), statistic: 'Average' }),
          distribution.metric5xxErrorRate({ period: cdk.Duration.hours(1), statistic: 'Average' }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Crawler: invocations, errors, duration',
        left: [
          crawler.metricInvocations({ period: cdk.Duration.hours(4), statistic: 'Sum' }),
          crawler.metricErrors({ period: cdk.Duration.hours(4), statistic: 'Sum' }),
        ],
        right: [crawler.metricDuration({ period: cdk.Duration.hours(4), statistic: 'Average' })],
        width: 12,
      }),
    );
    dash.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Problem clubs per crawl (suspect or failed parsers, by city)',
        left: [
          problemClubs.with({ label: 'total' }),
          new cloudwatch.Metric({
            namespace: 'JazzLineup', metricName: 'ProblemClubs',
            dimensionsMap: { City: 'nyc' }, period: cdk.Duration.hours(4), statistic: 'Maximum', label: 'nyc',
          }),
          new cloudwatch.Metric({
            namespace: 'JazzLineup', metricName: 'ProblemClubs',
            dimensionsMap: { City: 'la' }, period: cdk.Duration.hours(4), statistic: 'Maximum', label: 'la',
          }),
          new cloudwatch.Metric({
            namespace: 'JazzLineup', metricName: 'ProblemClubs',
            dimensionsMap: { City: 'chi' }, period: cdk.Duration.hours(4), statistic: 'Maximum', label: 'chi',
          }),
          new cloudwatch.Metric({
            namespace: 'JazzLineup', metricName: 'ProblemClubs',
            dimensionsMap: { City: 'sf' }, period: cdk.Duration.hours(4), statistic: 'Maximum', label: 'sf',
          }),
        ],
        width: 24,
      }),
    );

    // --- Billing tripwire: static sites don't fall over, they run up bills ---
    // Realistic monthly spend is <$2; email at 80% of $10 = something is wrong
    // (hotlink storm, bandwidth abuse) long before it matters.
    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: 'jazzlineup-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 10, unit: 'USD' },
      },
      notificationsWithSubscribers: [{
        notification: {
          notificationType: 'ACTUAL',
          comparisonOperator: 'GREATER_THAN',
          threshold: 80,
          thresholdType: 'PERCENTAGE',
        },
        subscribers: [{ subscriptionType: 'EMAIL', address: ALERT_EMAIL }],
      }],
    });

    // --- Outputs ---------------------------------------------------------------
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=jazzlineup`,
      description: 'Traffic + crawler health dashboard',
    });
    new cdk.CfnOutput(this, 'AccessLogBucketName', {
      value: logBucket.bucketName,
      description: 'Raw CloudFront access logs (gzipped, 90-day retention)',
    });
    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      description: 'Point Cloudflare CNAMEs (@ and www, DNS-only) at this',
    });
    new cdk.CfnOutput(this, 'CrawlerFunctionName', {
      value: crawler.functionName,
      description: 'Invoke manually: aws lambda invoke --function-name <this> /tmp/out.json',
    });
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}

module.exports = { JazzLineupStack };
