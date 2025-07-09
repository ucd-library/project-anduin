import psycopg2
import os
import json
import dagster as dg
from dagster import AssetExecutionContext


DATA_DIR = '/opt/data'
os.makedirs(DATA_DIR, exist_ok=True)

# Recommended, use ~/.pg_service file set by pgfarm
conn = psycopg2.connect(
  host='pg', 
  database='postgres',
  user='postgres'
)

@dg.asset()
def get_users(context: AssetExecutionContext):
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM users")
        users = cursor.fetchall()
        for user in users:
            context.log.info(f"User: {user}")
            user_id = user[0]
            user = json.dumps(user)
            with open(os.path.join(DATA_DIR, f"user_{user_id}.json"), 'w') as f:
                f.write(user)
                context.log.info("Users updated")

    context.log.info(f"Fetched {len(users)} users")
    return users

@dg.asset()
def update_users(context: AssetExecutionContext, get_users):
    users = get_users
    for user in users:
        user_id = user[0]
        with open(os.path.join(DATA_DIR, f"user_{user_id}.json"), 'r') as f:
            user_data = json.load(f)
            context.log.info(f"Updating user {user_id} with data: {user_data}")
            user_data.append('new_value')
            with open(os.path.join(DATA_DIR, f"user_{user_id}_updated.json"), 'w') as f:
                json.dump(user_data, f)
                context.log.info(f"User {user_id} updated and saved to disk")

# Create a job that materializes both assets in the correct order
update_users_job = dg.define_asset_job(
    name="update_users_job",
    selection=dg.AssetSelection.assets(get_users, update_users)
)

defs = dg.Definitions(
  jobs=[update_users_job],
  assets=[get_users, update_users]
)