const axios = require("axios");

async function getTotalCommits(repoOwner, repoName, githubToken) {
  let page = 1;
  let totalCommits = 0;

  while (true) {
    const url = `https://api.github.com/repos/${repoOwner}/${repoName}/commits?per_page=100&page=${page}`;
    const commitsResponse = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    const commits = commitsResponse.data;
    if (commits.length === 0) {
      break;
    }
    totalCommits += commits.length;
    page++;
  }

  return totalCommits;
}

module.exports = { getTotalCommits };