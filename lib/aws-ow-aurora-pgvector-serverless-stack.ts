import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { AuroraClusterInstanceType, AuroraPort, AwsOwAuroraPgvectorServerlessStackProps } from './AwsOwAuroraPgvectorServerlessStackProps';
import { Duration, SecretValue } from 'aws-cdk-lib';
import { parseVpcSubnetType } from '../utils/vpc-type-parser';
import { SubnetSelection } from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';

export class AwsOwAuroraPgvectorServerlessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AwsOwAuroraPgvectorServerlessStackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, `${props.resourcePrefix}-VPC-Imported`, {
      vpcId: props.vpcId,
    });
    const vpcSubnetType = parseVpcSubnetType(props.vpcSubnetType);

    // define subnetAttributes as an array of Record<string, string> with subnetId comes from props.vpcPrivateSubnetIds and availabilityZone comes from props.vpcPrivateSubnetAzs
    const subnetAttributes: Record<string, string>[] = props.vpcPrivateSubnetIds.map((subnetId, index) => {
      return {
        subnetId: subnetId,
        availabilityZone: props.vpcPrivateSubnetAzs[index],
        routeTableId: props.vpcPrivateSubnetRouteTableIds[index],
        type: vpcSubnetType,
      };
    });
    console.log('subnetAttributes:', JSON.stringify(subnetAttributes));

    // retrieve subnets from vpc
    const vpcPrivateISubnets: cdk.aws_ec2.ISubnet[] = subnetAttributes.map((subnetAttribute) => {
      return ec2.Subnet.fromSubnetAttributes(this, subnetAttribute.subnetId, {
        subnetId: subnetAttribute.subnetId,
        availabilityZone: subnetAttribute.availabilityZone,
        routeTableId: subnetAttribute.routeTableId,
      });
    });
    const vpcSubnetSelection: SubnetSelection = vpc.selectSubnets({
      subnets: vpcPrivateISubnets,
      availabilityZones: props.vpcPrivateSubnetAzs,
    });

    // Create subnet group for Aurora cluster
    const auroraSubnetGroup = new rds.SubnetGroup(this, `${props.resourcePrefix}-aurora-pgvector-serverless-subnet-group`, {
      vpc,
      description: 'Subnet group for Aurora Serverless cluster',
      vpcSubnets: vpcSubnetSelection,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const auroraStorageEncryptionKmsKey = new kms.Key(this, `${props.resourcePrefix}-aurora-pgvector-serverless-storage-encryption-kms-key`, {
      enabled: true,
      enableKeyRotation: true,
      rotationPeriod: cdk.Duration.days(90),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
    });

    const auroraPort = AuroraPort.PostgreSQL;
    const auroraSecurityGroup = new ec2.SecurityGroup(this, `${props.resourcePrefix}-aurora-pgvector-serverless-security-group`, {
      vpc,
      allowAllOutbound: false,
      description: 'Security group for Aurora Serverless cluster',
    });
    auroraSecurityGroup.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // create custom monitoring role instead of using AWS managed policy
    const auroraMonitoringRole = new cdk.aws_iam.Role(this, `${props.resourcePrefix}-aurora-pgvector-serverless-monitoring-role`, {
      assumedBy: new cdk.aws_iam.ServicePrincipal('monitoring.rds.amazonaws.com'),
      description: 'Role for RDS Enhanced Monitoring',
      inlinePolicies: {
        monitoringPolicy: new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              actions: [
                'logs:CreateLogGroup',
                'logs:PutLogEvents',
                'logs:DescribeLogStreams',
                'logs:DescribeLogGroups',
                'cloudwatch:PutMetricData'
              ],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/rds/*`,
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/rds/*:log-stream:*`,
                `arn:aws:cloudwatch:${this.region}:${this.account}:*`
              ],
            }),
          ],
        }),
      },
    });
    auroraMonitoringRole.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // add NagSuppressions for the AwsSolutions-IAM5 warning for monitoringRole
    NagSuppressions.addResourceSuppressions(auroraMonitoringRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Custom monitoring role is used instead of AWS managed policy',
      },
    ]);

    const removalPolicy = props.deployEnvironment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
    const auroraPostgresEngineVersion = props.clusterScalabilityType === rds.ClusterScalabilityType.LIMITLESS
      ? rds.AuroraPostgresEngineVersion.VER_16_8_LIMITLESS
      : rds.AuroraPostgresEngineVersion.VER_17_4;
    const auroraDatabaseCluster = new rds.DatabaseCluster(this, `${props.resourcePrefix}-aurora-pgvector-serverless-database-cluster`, {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: auroraPostgresEngineVersion }),
      vpc,
      vpcSubnets: vpcSubnetSelection,
      securityGroups: [auroraSecurityGroup],
      autoMinorVersionUpgrade: true,
      serverlessV2MaxCapacity: props.serverlessV2MaxCapacity,
      serverlessV2MinCapacity: props.serverlessV2MinCapacity,
      writer: rds.ClusterInstance.serverlessV2(AuroraClusterInstanceType.Writer),
      readers: [
        rds.ClusterInstance.serverlessV2(AuroraClusterInstanceType.Reader, {
          scaleWithWriter: false,
        }),
      ],
      storageEncrypted: true,
      storageEncryptionKey: auroraStorageEncryptionKmsKey,
      credentials: rds.Credentials.fromPassword(props.rdsUsername, SecretValue.unsafePlainText(props.rdsPassword)),
      removalPolicy,
      iamAuthentication: true,
      backup: {
        retention: cdk.Duration.days(14),
        preferredWindow: '03:00-04:00',
      },
      storageType: props.storageType,
      defaultDatabaseName: props.defaultDatabaseName,
      monitoringInterval: cdk.Duration.seconds(props.monitoringInterval),
      monitoringRole: auroraMonitoringRole,
      enableClusterLevelEnhancedMonitoring: props.deployEnvironment === 'production',
      clusterScalabilityType: props.clusterScalabilityType,
      instanceUpdateBehaviour: rds.InstanceUpdateBehaviour.ROLLING,
      port: auroraPort,
      subnetGroup: auroraSubnetGroup,
      deletionProtection: false,
      serverlessV2AutoPauseDuration: cdk.Duration.hours(1),
    });

    // Add suppression for the deletion protection warning
    NagSuppressions.addResourceSuppressions(auroraDatabaseCluster, [
      {
        id: 'AwsSolutions-RDS10',
        reason: 'Deletion protection is intentionally disabled for development/testing purposes',
      },
    ]);

    // Add suppression for the default endpoint port warning
    NagSuppressions.addResourceSuppressions(auroraDatabaseCluster, [
      {
        id: 'AwsSolutions-RDS11',
        reason: 'AwsSolutions-RDS11: The RDS instance or Aurora DB cluster uses the default endpoint port.',
      },
    ]);

    // Add suppression for backtrack warning if using PostgreSQL
    NagSuppressions.addResourceSuppressions(auroraDatabaseCluster, [
      {
        id: 'AwsSolutions-RDS14',
        reason: 'Backtrack is not supported for Aurora PostgreSQL clusters',
      },
    ]);

    // Create IAM role for the Lambda function
    const createExtensionLambdaRole = new iam.Role(this, `${props.resourcePrefix}-create-extension-lambda-role`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for createExtensionLambda',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Grant Secrets Manager read permissions to the Lambda role
    createExtensionLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: [auroraDatabaseCluster.secret?.secretArn || ''],
    }));

    new cdk.CfnOutput(this, `${props.resourcePrefix}-aurora-pgvector-serverless-endpoint`, {
      value: auroraDatabaseCluster.clusterEndpoint.hostname,
      description: 'Aurora Endpoint',
      exportName: `${props.resourcePrefix}-aurora-pgvector-serverless-endpoint`,
    });

    new cdk.CfnOutput(this, `${props.resourcePrefix}-aurora-pgvector-serverless-arn`, {
      value: auroraDatabaseCluster.clusterArn,
      description: 'Aurora ARN',
      exportName: `${props.resourcePrefix}-aurora-pgvector-serverless-arn`,
    });

    new cdk.CfnOutput(this, `${props.resourcePrefix}-aurora-pgvector-serverless-security-group-id`, {
      value: auroraSecurityGroup.securityGroupId,
      description: 'Aurora Security Group ID',
      exportName: `${props.resourcePrefix}-aurora-pgvector-serverless-security-group-id`,
    });

    new cdk.CfnOutput(this, `${props.resourcePrefix}-aurora-pgvector-serverless-storage-encryption-kms-key-id`, {
      value: auroraStorageEncryptionKmsKey.keyId,
      description: 'Aurora Storage Encryption KMS Key ID',
      exportName: `${props.resourcePrefix}-aurora-pgvector-serverless-storage-encryption-kms-key-id`,
    });

    new cdk.CfnOutput(this, `${props.resourcePrefix}-aurora-pgvector-serverless-storage-encryption-kms-key-arn`, {
      value: auroraStorageEncryptionKmsKey.keyArn,
      description: 'Aurora Storage Encryption KMS Key ARN',
      exportName: `${props.resourcePrefix}-aurora-pgvector-serverless-storage-encryption-kms-key-arn`,
    });

    new cdk.CfnOutput(this, `${props.resourcePrefix}-aurora-pgvector-serverless-port`, {
      value: auroraPort.toString(),
      description: 'Aurora Port',
      exportName: `${props.resourcePrefix}-aurora-pgvector-serverless-port`,
    });

    // export auroraDatabaseCluster arn
    new cdk.CfnOutput(this, `${props.resourcePrefix}-aurora-pgvector-serverless-database-cluster-arn`, {
      value: auroraDatabaseCluster.clusterArn,
      description: 'Aurora Database Cluster ARN',
      exportName: `${props.resourcePrefix}-aurora-pgvector-serverless-database-cluster-arn`,
    });

    // Create a security group for the Lambda function
    const lambdaFnSecGrp = new ec2.SecurityGroup(this, `${props.resourcePrefix}-lambda-security-group`, {
      vpc,
      allowAllOutbound: true, // Lambda needs to reach Secrets Manager and RDS
      description: 'Security group for Lambda function to connect to Aurora',
    });
    lambdaFnSecGrp.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Allow the Lambda security group to connect to the Aurora security group
    auroraSecurityGroup.addIngressRule(
      lambdaFnSecGrp,
      ec2.Port.tcp(auroraPort),
      'Allow Lambda to connect to Aurora'
    );

    // Create KMS Key for encryption with automatic rotation
    const environmentEncryptionKmsKey = new kms.Key(this, `${props.resourcePrefix}-environmentEncryptionKmsKey`, {
      enabled: true,
      enableKeyRotation: true,
      rotationPeriod: Duration.days(90),
      description: 'Key for encrypting environment variables',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Function to initialize the pgvector extension on the RDS instance
    const rdsPgExtensionInitFn = new PythonFunction(this, `${props.resourcePrefix}-rdsPgExtensionInitFn`, {
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_13,
      entry: path.join(__dirname, '../src/lambdas/create-pgvector-extension'),
      index: "index.py",
      handler: "handler",
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      logGroup: new cdk.aws_logs.LogGroup(this, `${props.resourcePrefix}-rdsPgExtensionInitFn-LogGroup`, {
          logGroupName: `${props.resourcePrefix}-rdsPgExtensionInitFn-LogGroup`,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          retention: cdk.aws_logs.RetentionDays.ONE_MONTH,
      }),
      environment: {
          DB_NAME: props.defaultDatabaseName,
          DB_USER: props.rdsUsername,
          DB_HOST: auroraDatabaseCluster.clusterEndpoint.hostname,
          DB_PORT: auroraPort.toString(),
          DB_PASSWORD: props.rdsPassword,
          PGVECTOR_DRIVER: props.pgvectorDriver,
          EMBEDDING_MODEL_DIMENSIONS: props.embeddingModelDimensions,
      },
      environmentEncryption: environmentEncryptionKmsKey,
      role: createExtensionLambdaRole,
      vpc: vpc,
      securityGroups: [lambdaFnSecGrp],
      vpcSubnets: vpcSubnetSelection,
      logRemovalPolicy: cdk.RemovalPolicy.DESTROY,
      retryAttempts: 2,
    });
    rdsPgExtensionInitFn.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Create an EventBridge rule to trigger the Lambda when a new writer instance is added
    new events.Rule(this, `${props.resourcePrefix}-aurora-instance-scaling-event`, {
      eventPattern: {
        source: ['aws.rds'],
        detailType: ['RDS DB Instance Event'],
        detail: {
          Message: [
            {
              prefix: 'Database cluster created',
            },
            {
              prefix: 'DB instance created',
            },
            {
              prefix: 'DB instance started',
            },
            {
              prefix: 'DB instance available',
            },
          ],
          SourceArn: [auroraDatabaseCluster.clusterArn],
        },
      },
      targets: [new targets.LambdaFunction(rdsPgExtensionInitFn)],
    });
  }
}
