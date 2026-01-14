const TYPE_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)*$/;

function runDoctrineChecks(event, file) {
  const issues = [];
  const typeValue = event.type;

  if (typeof typeValue === "string" && typeValue.length > 0) {
    if (!TYPE_PATTERN.test(typeValue)) {
      issues.push({
        file,
        message: "Event type should be lowercase dot-delimited (example: order.created)."
      });
    }
  }

  return issues;
}

module.exports = {
  runDoctrineChecks
};
