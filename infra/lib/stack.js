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
const { Construct } = require('constructs');

const DOMAIN = 'jazzlineup.com';

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

    // --- CloudFront ----------------------------------------------------------
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
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

    // --- Schedule: every 4 hours ---------------------------------------------
    new events.Rule(this, 'CrawlSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(4)),
      targets: [new targets.LambdaFunction(crawler, { retryAttempts: 1 })],
    });

    // --- Outputs ---------------------------------------------------------------
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
