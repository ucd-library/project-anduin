#https://docs.dagster.io/guides/build/partitions-and-backfills/partitioning-assets#dynamic-partitions

from dagster import asset, DynamicOutput, AssetExecutionContext
import psycopg2
import os
import hashlib
import json
import dagster as dg
import time


DATA_DIR = '/opt/data'
os.makedirs(DATA_DIR, exist_ok=True)

# Recommended, use ~/.pg_service file set by pgfarm
conn = psycopg2.connect(
  host='pg', 
  database='postgres',
  user='postgres'
)

users_partitions = dg.DynamicPartitionsDefinition(name="users")

# condition = dg.AutomationCondition.eager().replace(
#     "newly_updated", dg.AutomationCondition.data_version_changed()
# )

# condition = dg.AutomationCondition.eager().replace(
#     "newly_updated", dg.AutomationCondition.data_version_changed()
# )


# # Wrap it with a rule using materialize_on (not decision_type)
# rule = dg.AutoMaterializeRule.materialize_on(condition)

# # Use a set of rules to build the policy
# custom_policy = automation_condition=(
#         AutomationCondition.on_cron("@daily") |
        
#     )

@dg.asset(
  partitions_def=users_partitions,
  code_version="1.1"
)
def get_users_partition(context) -> dg.MaterializeResult:
    user_id = context.partition_key

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE cas_id = %s", (user_id,))
    user = cursor.fetchone()

    context.log.info(f"User: {user}")
    user_data = {
        "id": str(user[0]),
        "cas_id": user[1],
        "name": user[2]
    }
    user_json = json.dumps(user_data)
    with open(os.path.join(DATA_DIR, f"user_{user_id}.json"), 'w') as f:
        f.write(user_json)
        context.log.info(f"User {user_id} data written to file")

    return dg.MaterializeResult(metadata={"id": user[2]}, data_version=dg.DataVersion(user[2]))

@dg.asset(
    partitions_def=users_partitions,
    code_version="1.1"
)
def update_users_partition(context: AssetExecutionContext, get_users_partition) -> dg.MaterializeResult:
    user_id = context.partition_key

    upstream_result = get_users_partition
    context.log.info(f"Upstream metadata for user {user_id}")
    context.log.info(upstream_result)

    with open(os.path.join(DATA_DIR, f"user_{user_id}.json"), 'r') as f:
        user_data = json.load(f)
        context.log.info(f"Updating user {user_id} with data: {user_data}")
        user_data['new_value'] = True
        with open(os.path.join(DATA_DIR, f"user_{user_id}_updated.json"), 'w') as f:
            json.dump(user_data, f)
            context.log.info(f"User {user_id} updated and saved to disk")
            response_hash = hashlib.sha256(json.dumps(user_data).encode()).hexdigest()

    time.sleep(5)

    return dg.MaterializeResult(data_version=dg.DataVersion(response_hash))

# Create a job that materializes both assets in the correct order
update_users_dynamic_job = dg.define_asset_job(
    name="update_users_dynamic_job",
    selection=dg.AssetSelection.assets(get_users_partition, update_users_partition)
)


@dg.sensor(
    job=update_users_dynamic_job, 
    minimum_interval_seconds=3600
)
def all_regions_sensor(context: dg.SensorEvaluationContext):
    cursor = conn.cursor()
    cursor.execute("SELECT cas_id FROM users")
    users = cursor.fetchall()

    user_ids = [user[0] for user in users]

    return dg.SensorResult(
        run_requests=[dg.RunRequest(partition_key=user) for user in user_ids],
        dynamic_partitions_requests=[users_partitions.build_add_request(user_ids)],
    )


defs = dg.Definitions(
    jobs=[update_users_dynamic_job],
    assets=[get_users_partition, update_users_partition],
    sensors=[all_regions_sensor]
)