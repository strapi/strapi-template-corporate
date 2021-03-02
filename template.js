module.exports = function(scope) {
  return {
    package: {
      dependencies: {
        "strapi-plugin-graphql": scope.strapiVersion,
      }
    }
  }
}
