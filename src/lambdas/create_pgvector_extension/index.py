import os
import psycopg
import json
import boto3

def get_secret(secret_name):
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId=secret_name)
    if 'SecretString' in response:
        return json.loads(response['SecretString'])
    else:
        return json.loads(response['SecretBinary'].decode('utf-8'))

def handler(event, context):
    print(f"Received event: {json.dumps(event)}")

    db_secret_arn = os.environ.get("DB_SECRET_ARN")
    vector_dimensions = os.environ.get("VECTOR_DIMENTIONS")

    if not db_secret_arn:
        raise ValueError("DB_SECRET_ARN environment variable not set.")
    if not vector_dimensions:
        raise ValueError("VECTOR_DIMENTIONS environment variable not set.")

    try:
        secret = get_secret(db_secret_arn)
        db_host = os.environ.get("DB_HOST")
        db_name = os.environ.get("DB_NAME")
        db_user = secret['username']
        db_password = secret['password']

        if not all([db_host, db_name, db_user, db_password]):
            raise ValueError("Missing one or more database connection parameters.")

        conn = psycopg.connect(host=db_host, dbname=db_name, user=db_user, password=db_password)
        cur = conn.cursor()

        # Create the vector extension with the specified dimensions
        cur.execute(f"CREATE EXTENSION IF NOT EXISTS vector WITH (dim = {vector_dimensions});")
        conn.commit()

        cur.close()
        conn.close()

        print(f"Successfully created vector extension with dimensions {vector_dimensions}.")
        return {
            'statusCode': 200,
            'body': json.dumps(f'Vector extension with dimensions {vector_dimensions} created successfully!')
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error creating vector extension: {e}')
        }