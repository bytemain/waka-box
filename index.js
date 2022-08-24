require("dotenv").config();
const { WakaTimeClient, RANGE } = require("wakatime-client");
const Octokit = require("@octokit/rest");
const SDK = require("@yuque/sdk");

const {
  GIST_ID: gistId,
  GH_TOKEN: githubToken,
  WAKATIME_API_KEY: wakatimeApiKey,
  YUQUE_TOKEN: yuqueToken,
  YUQUE_NAMESPACE: yuqueNamespace,
  YUQUE_DOC_ID: yuqueDocId
} = process.env;

const wakatime = new WakaTimeClient(wakatimeApiKey);

async function main() {
  const stats = await wakatime.getMyStats({ range: RANGE.LAST_7_DAYS });
  await updateRemote(stats);
}

function trimRightStr(str, len) {
  // Ellipsis takes 3 positions, so the index of substring is 0 to total length - 3.
  return str.length > len ? str.substring(0, len - 3) + "..." : str;
}

async function updateGist(content) {
  if (!(gistId && githubToken)) {
    console.info(`!(gistId && githubToken), skip`);
    return;
  }
  const octokit = new Octokit({ auth: `token ${githubToken}` });

  let gist;
  try {
    gist = await octokit.gists.get({
      gist_id: gistId
    });
  } catch (error) {
    console.error(`Unable to get gist\n${error}`);
  }

  // Get original filename to update that same file
  const filename = Object.keys(gist.data.files)[0];
  await octokit.gists.update({
    gist_id: gistId,
    files: {
      [filename]: {
        filename: `📊 Weekly development breakdown`,
        content: content
      }
    }
  });
}

async function updateYuque(content) {
  if (!(yuqueToken && yuqueNamespace && yuqueDocId)) {
    console.info(`!(yuqueToken && yuqueNamespace && yuqueDocId), skip`);
    return;
  }

  const client = new SDK({
    token: yuqueToken,
    handler: res => {
      console.log(res);
      return res.data.data;
    }
  });

  await client.docs.update({
    namespace: yuqueNamespace,
    id: yuqueDocId,
    data: {
      title: `📊 Weekly development breakdown`,
      body: `\`\`\`text
${content}
\`\`\`
`
    }
  });
}

async function updateRemote(stats) {
  const lines = [];
  for (let i = 0; i < Math.min(stats.data.languages.length, 5); i++) {
    const data = stats.data.languages[i];
    const { name, percent, text: time } = data;

    const line = [
      trimRightStr(name, 10).padEnd(10),
      time.padEnd(14),
      generateBarChart(percent, 21),
      String(percent.toFixed(1)).padStart(5) + "%"
    ];

    lines.push(line.join(" "));
  }

  if (lines.length == 0) return;

  try {
    const content = lines.join("\n");
    await updateGist(content);
    await updateYuque(content);
  } catch (error) {
    console.error(`Unable to update remote\n${error.stack}`);
  }
}

function generateBarChart(percent, size) {
  const syms = "░▏▎▍▌▋▊▉█";

  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);
  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size);
  }
  const semi = frac % 8;

  return [syms.substring(8, 9).repeat(barsFull), syms.substring(semi, semi + 1)]
    .join("")
    .padEnd(size, syms.substring(0, 1));
}

(async () => {
  await main();
})();
