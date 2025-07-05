# AWS Aurora PostgreSQL with pgvector Extension - Serverless Infrastructure

A comprehensive AWS CDK TypeScript project that deploys a production-ready Aurora PostgreSQL Serverless v2 cluster with the pgvector extension for vector similarity search capabilities. This infrastructure is designed for AI/ML applications requiring vector storage and similarity search functionality.

## 🚀 Features

- **Aurora PostgreSQL Serverless v2**: Auto-scaling database cluster with pay-per-use pricing
- **pgvector Extension**: Native PostgreSQL extension for vector operations and similarity search
- **Automated Extension Setup**: Lambda function automatically initializes pgvector extension and creates vector tables
- **Production-Ready Security**: KMS encryption, IAM authentication, VPC isolation, and security groups
- **Monitoring & Observability**: Enhanced monitoring with custom CloudWatch metrics
- **Event-Driven Architecture**: Automatic extension setup triggered by Aurora cluster events
- **Infrastructure as Code**: Complete CDK implementation with TypeScript
- **Security Best Practices**: CDK-NAG compliance with security suppressions

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS CDK Stack                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │   Aurora        │    │   Lambda        │    │   EventBridge│  │
│  │   PostgreSQL    │◄───┤   Function      │◄───┤   Rule       │  │
│  │   Serverless v2 │    │   (pgvector     │    │             │  │
│  │                 │    │    setup)       │    │             │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
│           │                       │                              │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   KMS Keys      │    │   Security      │                     │
│  │   (Encryption)  │    │   Groups        │                     │
│  └─────────────────┘    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

1. **Aurora PostgreSQL Serverless v2 Cluster**
   - Writer and reader instances with auto-scaling
   - Support for both standard and limitless scalability
   - Storage encryption with customer-managed KMS keys
   - IAM database authentication
   - Automated backups with configurable retention

2. **Lambda Function for pgvector Setup**
   - Python-based Lambda function
   - Automatically creates pgvector extension
   - Sets up vector tables with configurable dimensions
   - Event-driven execution via EventBridge

3. **Security Infrastructure**
   - VPC isolation with private subnets
   - Security groups for network access control
   - KMS encryption for data at rest
   - IAM roles with least privilege access

## 📋 Prerequisites

- **AWS CLI** configured with appropriate permissions
- **Node.js** (v18 or later)
- **AWS CDK** CLI (`npm install -g aws-cdk`)
- **Python** (3.9+) for Lambda function development
- **Existing VPC** with private subnets for database deployment

### Required AWS Permissions

The deploying user/role needs permissions for:

- RDS (Aurora)
- Lambda
- IAM
- KMS
- VPC
- EventBridge
- CloudWatch
- Secrets Manager

## 🛠️ Installation & Setup

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd aws-ow-aurora-pgvector-serverless
npm install
```

### 2. Environment Configuration

Create a `.env` file in the project root with the following variables:

```bash
# Application Configuration
APP_NAME=my-vector-app
ENVIRONMENT=development
OWNER=your-team-name
CDK_DEPLOY_REGION=us-east-1

# VPC Configuration
VPC_ID=vpc-xxxxxxxxx
VPC_SUBNET_TYPE=private
VPC_PRIVATE_SUBNET_IDS=subnet-xxxxxxxxx,subnet-yyyyyyyyy
VPC_PRIVATE_SUBNET_AZS=us-east-1a,us-east-1b
VPC_PRIVATE_SUBNET_ROUTE_TABLE_IDS=rtb-xxxxxxxxx,rtb-yyyyyyyyy

# Aurora Configuration
SERVERLESS_V2_MAX_CAPACITY=16
SERVERLESS_V2_MIN_CAPACITY=0.5
RDS_USERNAME=admin
RDS_PASSWORD=your-secure-password
DEFAULT_DATABASE_NAME=vectordb
STORAGE_TYPE=aurora-iopt1
MONITORING_INTERVAL=60
CLUSTER_SCALABILITY_TYPE=standard

# pgvector Configuration
PGVECTOR_DRIVER=psycopg
EMBEDDING_MODEL_DIMENSIONS=1536
```

### 3. Bootstrap CDK (First Time Only)

```bash
npx cdk bootstrap
```

## 🚀 Deployment

### Development Deployment

```bash
# Build the project
npm run build

# Deploy the stack
npx cdk deploy
```

### Production Deployment

```bash
# Set environment to production
export ENVIRONMENT=production

# Deploy with production settings
npx cdk deploy --require-approval never
```

### Deployment Scripts

The project includes convenient deployment scripts:

```bash
# Bootstrap CDK
./cdk-run-bootstrap.sh

# Deploy stack
./cdk-run-deploy.sh
```

## 🔧 Configuration Options

### Aurora Cluster Configuration

| Parameter | Description | Default | Options |
|-----------|-------------|---------|---------|
| `SERVERLESS_V2_MAX_CAPACITY` | Maximum ACU for scaling | 16 | 0.5 - 128 |
| `SERVERLESS_V2_MIN_CAPACITY` | Minimum ACU for scaling | 0.5 | 0.5 - 128 |
| `STORAGE_TYPE` | Aurora storage type | aurora-iopt1 | aurora, aurora-iopt1 |
| `CLUSTER_SCALABILITY_TYPE` | Scaling configuration | standard | standard, limitless |

### pgvector Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `PGVECTOR_DRIVER` | PostgreSQL driver | psycopg |
| `EMBEDDING_MODEL_DIMENSIONS` | Vector dimensions | 1536 |

### Security Configuration

- **Storage Encryption**: Enabled with customer-managed KMS keys
- **IAM Authentication**: Enabled for database access
- **VPC Isolation**: Private subnets only
- **Security Groups**: Restrictive access controls

## 📊 Monitoring & Observability

### CloudWatch Metrics

The stack provides enhanced monitoring with:

- Database performance metrics
- Lambda function execution metrics
- Custom KMS key usage metrics

### Logs

- **Aurora Logs**: Available in CloudWatch Logs
- **Lambda Logs**: Function execution logs with structured logging
- **CDK Deployment Logs**: Infrastructure deployment logs

### Alarms

Consider setting up CloudWatch alarms for:

- Database CPU utilization
- Lambda function errors
- KMS key usage
- Storage space utilization

## 🔐 Security Features

### Data Protection

- **Encryption at Rest**: All data encrypted with customer-managed KMS keys
- **Encryption in Transit**: TLS/SSL for all database connections
- **IAM Authentication**: Database access via IAM roles

### Network Security

- **VPC Isolation**: Database deployed in private subnets
- **Security Groups**: Restrictive inbound/outbound rules
- **No Public Access**: Database not accessible from internet

### Access Control

- **Least Privilege**: IAM roles with minimal required permissions
- **Secret Management**: Database credentials stored in Secrets Manager
- **Audit Logging**: All access logged to CloudTrail

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
# Deploy test stack
npx cdk deploy --context test=true

# Run integration tests
npm run test:integration
```

### CDK Validation

```bash
# Validate CDK app
npx cdk synth

# Check for security issues
npx cdk-nag
```

## 📈 Usage Examples

### Connecting to the Database

```python
import psycopg2
import os

# Get connection details from environment or Secrets Manager
conn = psycopg2.connect(
    host=os.environ['DB_HOST'],
    database=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD'],
    port=os.environ['DB_PORT']
)

# Create vector table
with conn.cursor() as cur:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            content TEXT,
            embedding vector(1536)
        );
    """)
    conn.commit()
```

### Vector Similarity Search

```python
import numpy as np

# Insert vector data
embedding = np.random.rand(1536).tolist()
with conn.cursor() as cur:
    cur.execute("""
        INSERT INTO documents (content, embedding)
        VALUES (%s, %s)
    """, ("Sample document", embedding))
    conn.commit()

# Perform similarity search
query_embedding = np.random.rand(1536).tolist()
with conn.cursor() as cur:
    cur.execute("""
        SELECT content, embedding <=> %s as distance
        FROM documents
        ORDER BY embedding <=> %s
        LIMIT 5
    """, (query_embedding, query_embedding))
    
    results = cur.fetchall()
    for content, distance in results:
        print(f"Content: {content}, Distance: {distance}")
```

## 🔄 Lambda Function Details

### pgvector Extension Setup

The Lambda function (`src/lambdas/create-pgvector-extension/`) automatically:

1. **Connects to Aurora**: Uses environment variables for database connection
2. **Creates Extension**: Installs pgvector extension if not present
3. **Sets Up Tables**: Creates vector tables with specified dimensions
4. **Configures Indexes**: Sets up HNSW or IVFFlat indexes for efficient search

### Event Triggers

The function is triggered by Aurora events:

- Database cluster creation
- DB instance creation
- DB instance startup
- DB instance availability

### Customization

Modify the Lambda function to:

- Add custom metadata columns
- Configure hybrid search (text + vector)
- Set up different index types
- Add custom validation logic

## 🗂️ Project Structure

```
aws-ow-aurora-pgvector-serverless/
├── bin/                                    # CDK app entry point
│   └── aws-ow-aurora-pgvector-serverless.ts
├── lib/                                    # CDK stack definitions
│   ├── aws-ow-aurora-pgvector-serverless-stack.ts
│   └── AwsOwAuroraPgvectorServerlessStackProps.ts
├── src/lambdas/                           # Lambda functions
│   └── create-pgvector-extension/
│       ├── index.py                       # Main Lambda handler
│       ├── engine.py                      # Database engine wrapper
│       ├── hybrid_search_config.py        # Hybrid search configuration
│       └── requirements.txt               # Python dependencies
├── utils/                                 # Utility functions
│   ├── apply-tag.ts                      # Resource tagging
│   ├── check-environment-variable.ts     # Environment validation
│   ├── cluster-scalability-parser.ts     # Scalability type parsing
│   ├── storage-type-parser.ts            # Storage type parsing
│   └── vpc-type-parser.ts                # VPC type parsing
├── test/                                  # Test files
├── cdk.json                              # CDK configuration
├── package.json                          # Node.js dependencies
└── README.md                             # This file
```

## 🚨 Troubleshooting

### Common Issues

1. **VPC Configuration Errors**
   - Ensure VPC exists and subnets are properly configured
   - Verify subnet route tables allow necessary traffic

2. **Lambda Function Failures**
   - Check CloudWatch logs for detailed error messages
   - Verify database credentials and network connectivity
   - Ensure pgvector extension is available in Aurora version

3. **Permission Errors**
   - Verify IAM roles have necessary permissions
   - Check KMS key policies for encryption/decryption access

4. **Connection Issues**
   - Verify security group rules allow Lambda to Aurora communication
   - Check VPC endpoints for AWS services if using private subnets

### Debug Commands

```bash
# Check CDK diff
npx cdk diff

# View CloudFormation template
npx cdk synth

# Check Lambda logs
aws logs tail /aws/lambda/<function-name> --follow

# Test database connectivity
aws rds describe-db-clusters --db-cluster-identifier <cluster-name>
```

## 📚 Additional Resources

- [Aurora PostgreSQL Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.AuroraPostgreSQL.html)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review AWS documentation for Aurora and pgvector

---

**Note**: This infrastructure is designed for production use but should be thoroughly tested in your specific environment before deploying to production workloads.
