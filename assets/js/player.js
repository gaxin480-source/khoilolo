document.addEventListener("DOMContentLoaded", async () => {
const app = document.getElementById("watchApp");
const slug = window.StreamUI.getQueryParam("slug");
const anime = await window.StreamUI.getAnimeBySlug(slug);

if (!anime) {
app.innerHTML = <div class="watch-stage"><div class="empty-state">Playback unavailable.</div></div>;
return;
}

let seasonNumber = Number(window.StreamUI.getQueryParam("season", anime.seasons?.[0]?.seasonNumber || 1));
let episodeNumber = Number(window.StreamUI.getQueryParam("episode", anime.seasons?.[0]?.episodes?.[0]?.number || 1));

let allEpisodes = [];
let currentEpisode = null;
let currentIndex = -1;
let hls = null;
let boundVideo = null;

const detailLink = document.getElementById("backToDetail");
if (detailLink) {
detailLink.href = window.StreamUI.buildUrl("detail.html", { slug: anime.slug });
}

allEpisodes = (anime.seasons || []).flatMap(season =>
(season.episodes || []).map(ep => ({
...ep,
seasonNumber: season.seasonNumber
}))
);

resolveCurrentEpisode();
renderShell();
attachPlayer();

function resolveCurrentEpisode() {
const found = allEpisodes.find(
ep => Number(ep.seasonNumber) === Number(seasonNumber) && Number(ep.number) === Number(episodeNumber)
);

const fallback = found || allEpisodes[0];
if (!fallback) return;

seasonNumber = Number(fallback.seasonNumber);
episodeNumber = Number(fallback.number);
currentEpisode = fallback;

currentIndex = allEpisodes.findIndex(
  ep => Number(ep.seasonNumber) === Number(seasonNumber) && Number(ep.number) === Number(episodeNumber)
);

}

function renderShell() {
window.StreamUI.setMeta(
${anime.title} · Tập ${episodeNumber} · KageStream,
anime.description
);

app.innerHTML = `
  <section class="watch-stage">
    <section class="watch-layout">
      <div class="player-column">
        <div class="player-shell">
          <div class="video-frame">
            <video id="videoPlayer" controls playsinline webkit-playsinline preload="metadata"></video>
          </div>
          <div class="player-info">
            <h2 class="player-anime-title">
              ${window.StreamUI.escapeHtml(anime.title)}
            </h2>
            <div class="player-episode">
              Tập ${episodeNumber}
            </div>
            <p class="player-description">
              ${window.StreamUI.escapeHtml(anime.description)}
            </p>
          </div>
        </div>
      </div>
      <aside class="sidebar">
        <div class="sidebar-head">
          <h3>Episodes</h3>
        </div>
        <div class="episode-list">
          ${allEpisodes.map(episode => {
            const active =
              Number(episode.seasonNumber) === Number(seasonNumber) &&
              Number(episode.number) === Number(episodeNumber);

            return `
              <button
                class="episode-button ${active ? "is-active" : ""}"
                data-season="${episode.seasonNumber}"
                data-episode="${episode.number}"
              >
                <div class="episode-thumb">
                  <img src="${window.StreamUI.escapeHtml(anime.cover)}" loading="lazy"/>
                </div>
                <div class="episode-button-top">
                  <span class="episode-index">Tập ${episode.number}</span>
                </div>
                <h4 class="episode-title">
                  ${window.StreamUI.escapeHtml(anime.title)}
                </h4>
              </button>
            `;
          }).join("")}
        </div>
      </aside>
    </section>
  </section>
`;

bindEpisodeButtons();

}

function bindEpisodeButtons() {
app.querySelectorAll(".episode-button").forEach(button => {
button.addEventListener("click", () => {
seasonNumber = Number(button.dataset.season);
episodeNumber = Number(button.dataset.episode);

    resolveCurrentEpisode();

    history.replaceState({}, "", window.StreamUI.watchHref(anime, seasonNumber, episodeNumber));

    renderShell();
    attachPlayer();
  });
});

}

function getEpisodeStream(episode) {
return (
episode?.stream ||
episode?.src ||
episode?.url ||
episode?.file ||
episode?.master ||
episode?.playlist ||
episode?.hls ||
episode?.sources?.hls ||
episode?.sources?.master ||
episode?.sources?.stream ||
""
);
}

function getEpisodeSubtitles(episode) {
return (
episode?.subtitles ||
episode?.subtitle ||
episode?.captions ||
episode?.vtt ||
episode?.sources?.subtitles ||
""
);
}

function getEpisodeThumbnails(episode) {
return (
episode?.thumbnails ||
episode?.thumbnailVtt ||
episode?.previewVtt ||
episode?.sources?.thumbnails ||
""
);
}

function bindVideoEvents(video) {
if (boundVideo && boundVideo !== video) {
if (boundVideo.__onTimeUpdate) {
boundVideo.removeEventListener("timeupdate", boundVideo.__onTimeUpdate);
}
if (boundVideo.__onEnded) {
boundVideo.removeEventListener("ended", boundVideo.__onEnded);
}
}

const onTimeUpdate = () => {
  if (!window.StreamStorage) return;

  window.StreamStorage.saveProgress({
    slug: anime.slug,
    season: seasonNumber,
    episode: episodeNumber,
    currentTime: video.currentTime,
    duration: video.duration,
    completed: false
  });
};

const onEnded = () => {
  const next = allEpisodes[currentIndex + 1];
  if (!next) return;

  window.location.href = window.StreamUI.watchHref(anime, next.seasonNumber, next.number);
};

if (video.__onTimeUpdate) {
  video.removeEventListener("timeupdate", video.__onTimeUpdate);
}
if (video.__onEnded) {
  video.removeEventListener("ended", video.__onEnded);
}

video.__onTimeUpdate = onTimeUpdate;
video.__onEnded = onEnded;

video.addEventListener("timeupdate", onTimeUpdate);
video.addEventListener("ended", onEnded);

boundVideo = video;

}

async function attachPlayer() {
const video = document.getElementById("videoPlayer");
if (!video || !currentEpisode) return;

const rawStream = getEpisodeStream(currentEpisode);
if (!rawStream) {
  console.error("Episode thiếu field stream:", currentEpisode);
  video.removeAttribute("src");
  video.load();
  return;
}

const mediaBase = anime.streamRoot || `${window.location.origin}/`;
const streamUrl = new URL(rawStream, mediaBase).href;

const rawSubtitle = getEpisodeSubtitles(currentEpisode);
const subtitleUrl = rawSubtitle ? new URL(rawSubtitle, mediaBase).href : "";

const rawThumbnail = getEpisodeThumbnails(currentEpisode);
const thumbnailUrl = rawThumbnail ? new URL(rawThumbnail, mediaBase).href : "";

if (hls) {
  try {
    hls.destroy();
  } catch (e) {}
  hls = null;
}

video.pause();
removeThumbnailPreview();

video.querySelectorAll("track").forEach(t => t.remove());
video.removeAttribute("src");
video.load();

if (/\.m3u8($|\?)/i.test(streamUrl)) {
  if (window.Hls && window.Hls.isSupported()) {
    hls = new window.Hls({
      enableWorker: true,
      lowLatencyMode: false
    });

    hls.on(window.Hls.Events.ERROR, (event, data) => {
      console.error("HLS error:", data);
    });

    hls.loadSource(streamUrl);
    hls.attachMedia(video);
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = streamUrl;
  } else {
    console.error("Browser không hỗ trợ HLS:", streamUrl);
    return;
  }
} else {
  video.src = streamUrl;
}

if (subtitleUrl) {
  const track = document.createElement("track");
  track.kind = "subtitles";
  track.label = "Tiếng Việt";
  track.srclang = "vi";
  track.src = subtitleUrl;
  track.default = true;
  video.appendChild(track);
}

bindVideoEvents(video);
video.load();

setupThumbnailPreview(video, {
  ...currentEpisode,
  thumbnails: thumbnailUrl
});

if (window.StreamStorage) {
  window.StreamStorage.saveWatchState(anime.slug, seasonNumber, episodeNumber);
}

console.log("Playing stream:", streamUrl);

}

async function setupThumbnailPreview(video, episode) {
removeThumbnailPreview();

if (!episode?.thumbnails) return;

let cues = [];
try {
  cues = await loadThumbnailVtt(episode.thumbnails);
} catch (err) {
  console.warn("Failed to load thumbnails:", err);
  return;
}

if (!cues.length) return;

const wrapper = video.parentElement;
if (!wrapper) return;

wrapper.style.position = "relative";

const preview = document.createElement("div");
preview.id = "video-thumb-preview";
preview.style.position = "absolute";
preview.style.bottom = "56px";
preview.style.left = "0";
preview.style.transform = "translateX(-50%)";
preview.style.pointerEvents = "none";
preview.style.display = "none";
preview.style.background = "rgba(0,0,0,0.92)";
preview.style.border = "1px solid rgba(255,255,255,0.15)";
preview.style.borderRadius = "10px";
preview.style.padding = "6px";
preview.style.zIndex = "20";
preview.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";

const img = document.createElement("img");
img.style.display = "block";
img.style.width = "220px";
img.style.maxWidth = "220px";
img.style.height = "auto";
img.style.borderRadius = "6px";

const timeLabel = document.createElement("div");
timeLabel.style.marginTop = "6px";
timeLabel.style.fontSize = "12px";
timeLabel.style.color = "#fff";
timeLabel.style.textAlign = "center";
timeLabel.style.whiteSpace = "nowrap";

preview.appendChild(img);
preview.appendChild(timeLabel);
wrapper.appendChild(preview);

const progressHandler = (event) => {
  const rect = video.getBoundingClientRect();
  if (!rect.width || !video.duration || !isFinite(video.duration)) return;

  const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  const hoverTime = ratio * video.duration;
  const cue = findThumbnailCue(cues, hoverTime);

  if (!cue) {
    preview.style.display = "none";
    return;
  }

  img.src = cue.src;
  timeLabel.textContent = formatTime(hoverTime);

  const offsetX = ratio * rect.width;
  preview.style.left = `${offsetX}px`;
  preview.style.display = "block";
};

const leaveHandler = () => {
  preview.style.display = "none";
};

video.__thumbMoveHandler = progressHandler;
video.__thumbLeaveHandler = leaveHandler;
video.__thumbPreviewEl = preview;

video.addEventListener("mousemove", progressHandler);
video.addEventListener("mouseleave", leaveHandler);
video.addEventListener("seeking", leaveHandler);
video.addEventListener("play", leaveHandler);

}

function removeThumbnailPreview() {
const oldVideo = document.getElementById("videoPlayer");
if (!oldVideo) return;

if (oldVideo.__thumbMoveHandler) {
  oldVideo.removeEventListener("mousemove", oldVideo.__thumbMoveHandler);
  oldVideo.__thumbMoveHandler = null;
}

if (oldVideo.__thumbLeaveHandler) {
  oldVideo.removeEventListener("mouseleave", oldVideo.__thumbLeaveHandler);
  oldVideo.removeEventListener("seeking", oldVideo.__thumbLeaveHandler);
  oldVideo.removeEventListener("play", oldVideo.__thumbLeaveHandler);
  oldVideo.__thumbLeaveHandler = null;
}

if (oldVideo.__thumbPreviewEl && oldVideo.__thumbPreviewEl.parentNode) {
  oldVideo.__thumbPreviewEl.parentNode.removeChild(oldVideo.__thumbPreviewEl);
  oldVideo.__thumbPreviewEl = null;
}

}

async function loadThumbnailVtt(vttUrl) {
const response = await fetch(vttUrl, { cache: "no-store" });
if (!response.ok) {
throw new Error(Cannot load VTT: ${vttUrl});
}

const text = await response.text();
const baseUrl = vttUrl.substring(0, vttUrl.lastIndexOf("/") + 1);

const lines = text.replace(/\r/g, "").split("\n");
const cues = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  if (!line || line === "WEBVTT") continue;

  if (line.includes("-->")) {
    const parts = line.split("-->");
    const start = parseVttTime(parts[0].trim());
    const end = parseVttTime(parts[1].trim());

    let src = "";
    i++;

    while (i < lines.length && !lines[i].trim()) {
      i++;
    }

    if (i < lines.length) {
      src = lines[i].trim();
    }

    if (src) {
      const fullSrc = new URL(src, baseUrl).href;
      cues.push({ start, end, src: fullSrc });
    }
  }
}

return cues;

}

function parseVttTime(value) {
const match = value.match(/(?:(\d+):)?(\d+):(\d+).(\d+)/);
if (!match) return 0;

const hours = Number(match[1] || 0);
const minutes = Number(match[2] || 0);
const seconds = Number(match[3] || 0);
const millis = Number(match[4] || 0);

return (hours * 3600) + (minutes * 60) + seconds + (millis / 1000);

}

function findThumbnailCue(cues, time) {
for (const cue of cues) {
if (time >= cue.start && time <= cue.end) {
return cue;
}
}
return cues[cues.length - 1] || null;
}

function formatTime(seconds) {
if (!isFinite(seconds) || seconds < 0) seconds = 0;

const total = Math.floor(seconds);
const h = Math.floor(total / 3600);
const m = Math.floor((total % 3600) / 60);
const s = total % 60;

if (h > 0) {
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

return `${m}:${String(s).padStart(2, "0")}`;

}
});