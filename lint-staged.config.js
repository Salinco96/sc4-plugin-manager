module.exports = {
  "**/*.{ts,tsx}": filenames => [
    `eslint --fix ${filenames.map(filename => `"${filename}"`).join(" ")}`,
    "yarn typecheck",
  ],
  "**/*.{js,jsx,json,md,yml}": filenames => [
    `prettier --write ${filenames.map(filename => `"${filename}"`).join(" ")}`,
  ],
}
