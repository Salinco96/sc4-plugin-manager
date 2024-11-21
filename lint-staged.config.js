module.exports = {
  "*.{css,js,json,ts,tsx}": () => "yarn biome check --fix --staged",
  "*.{ts,tsx}": () => "yarn typecheck",
}
