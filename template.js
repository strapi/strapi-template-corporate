module.exports = function(scope) {
  console.log(scope);
  return {
    package: {
      dependencies: {
        "@strapi/plugin-graphql": scope.strapiVersion,
      }
    }
  }
}
