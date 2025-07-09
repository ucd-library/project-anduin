import dagster as dg

@dg.asset(code_version="v2")
def versioned_number():
    return 11


@dg.asset(code_version="v3")
def multiplied_number(versioned_number):
    return versioned_number * 2

@dg.job
def simple_cache():
    multiplied_number(versioned_number)

defs = dg.Definitions(
    jobs=[simple_cache],
  assets=[versioned_number, multiplied_number]
)