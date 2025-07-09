import dagster as dg

@dg.asset
def hello(context: dg.AssetExecutionContext):
    context.log.info("Hello!")


@dg.asset(deps=[hello])
def world(context: dg.AssetExecutionContext):
    context.log.info("World!")


defs = dg.Definitions(assets=[hello, world])