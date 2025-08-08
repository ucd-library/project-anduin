"""
Example Dagster definitions that work well with the Node.js materializer.
This demonstrates jobs with various configuration options and partitioning.
"""

import dagster as dg
import json
import os
from datetime import datetime, timedelta

# Simple job for demonstration
@dg.asset
def sample_data(context: dg.AssetExecutionContext):
    """Generate sample data for testing materialization."""
    data = {
        "timestamp": datetime.now().isoformat(),
        "run_id": context.run_id,
        "asset_key": str(context.asset_key)
    }
    
    context.log.info(f"Generated sample data: {data}")
    return data

@dg.asset(deps=[sample_data])
def processed_data(context: dg.AssetExecutionContext, sample_data):
    """Process the sample data."""
    processed = {
        **sample_data,
        "processed_at": datetime.now().isoformat(),
        "processing_version": "1.0"
    }
    
    context.log.info(f"Processed data: {processed}")
    return processed

# Job that can be called from Node.js
nodejs_demo_job = dg.define_asset_job(
    name="nodejs_demo_job",
    selection=dg.AssetSelection.assets(sample_data, processed_data),
    description="Demo job that can be materialized from Node.js"
)

# Partitioned assets for partition demonstration
daily_partitions = dg.DailyPartitionsDefinition(start_date="2024-01-01")

@dg.asset(
    partitions_def=daily_partitions,
    code_version="1.0"
)
def daily_sample_data(context: dg.AssetExecutionContext):
    """Generate daily partitioned sample data."""
    partition_date = context.partition_key
    
    data = {
        "date": partition_date,
        "timestamp": datetime.now().isoformat(),
        "run_id": context.run_id,
        "partition_key": partition_date
    }
    
    context.log.info(f"Generated daily data for {partition_date}: {data}")
    return data

@dg.asset(
    partitions_def=daily_partitions,
    deps=[daily_sample_data],
    code_version="1.0"
)
def daily_processed_data(context: dg.AssetExecutionContext, daily_sample_data):
    """Process daily partitioned data."""
    partition_date = context.partition_key
    
    processed = {
        **daily_sample_data,
        "processed_at": datetime.now().isoformat(),
        "processing_version": "2.0",
        "partition_key": partition_date
    }
    
    context.log.info(f"Processed daily data for {partition_date}: {processed}")
    return processed

# Partitioned job for Node.js partition examples
nodejs_partitioned_job = dg.define_asset_job(
    name="nodejs_partitioned_job",
    selection=dg.AssetSelection.assets(daily_sample_data, daily_processed_data),
    partitions_def=daily_partitions,
    description="Partitioned job that can be materialized from Node.js"
)

# Configurable job with run config
@dg.asset
def configurable_data(context: dg.AssetExecutionContext):
    """Asset that uses run configuration."""
    
    # Get configuration from run config (if provided)
    run_config = context.run.run_config
    op_config = run_config.get("ops", {}).get("configurable_data", {}).get("config", {})
    
    batch_size = op_config.get("batch_size", 10)
    environment = op_config.get("environment", "development")
    
    data = {
        "timestamp": datetime.now().isoformat(),
        "batch_size": batch_size,
        "environment": environment,
        "run_id": context.run_id
    }
    
    context.log.info(f"Generated configurable data with batch_size={batch_size}, environment={environment}")
    return data

# Job with configuration schema
nodejs_configurable_job = dg.define_asset_job(
    name="nodejs_configurable_job",
    selection=dg.AssetSelection.assets(configurable_data),
    description="Job with configurable parameters for Node.js examples"
)

# Combine all definitions
defs = dg.Definitions(
    assets=[
        sample_data, 
        processed_data, 
        daily_sample_data, 
        daily_processed_data,
        configurable_data
    ],
    jobs=[
        nodejs_demo_job,
        nodejs_partitioned_job,
        nodejs_configurable_job
    ]
)
