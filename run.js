"use strict"

console.log("running");

let maxCacheMinutes = 5;

let storiesPerLoad = 20;

let atStoryId = 0;
let atCommentId = 0;

let commentIndexWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--comment-indent-width").replace("px", ""));

let storiesDiv = document.getElementById("stories");
let storyTitleDiv = document.getElementById("storytitle");
let storyInfoDiv = document.getElementById("storyinfo");
let storyTextDiv = document.getElementById("storytext");
let commentsDiv = document.getElementById("comments");
let rightPaneDiv = document.getElementById("rightpane");

let curSortingType = "top";

let cachedReqs = {};

let storiesArray = [];
let atStoryInd = 0;

readHash();

reloadStories(true);

function reloadStories(openHashStory = false) {
	updateHash();
	storiesDiv.innerHTML = "";
	getApi(curSortingType + "stories.json").then(newStoriesArray => {
		console.log(`got ${newStoriesArray.length} top story ids`);

		storiesArray = newStoriesArray;
		atStoryInd = 0;

		loadStories(atStoryInd, atStoryInd + storiesPerLoad);
	});

	if (atStoryId != 0 && openHashStory) { // has story in hash
		getApi(`item/${atStoryId}.json`).then(curStory => { // doesn't matter that this fetch may be redundant as it would just be cached anyway
			console.log("attempting to open story from hash")
			openStory(curStory, true);
		});
	}
}

function loadMoreStories() {
	atStoryInd += storiesPerLoad;
	loadStories(atStoryInd, atStoryInd + storiesPerLoad);
}

function loadStories(storyFrom, storyTo) {
	for (let curStoryId of storiesArray.slice(storyFrom, storyTo)) {
		getApi(`item/${curStoryId}.json`).then(curStory => {
			let curStoryElem = getStoryElem(curStory);
			storiesDiv.appendChild(curStoryElem);
			console.log(`added story by ${curStory.by}`);
		});
	};
}

function displayStory(curStory) { // also probably not xss safe
	storyTitleDiv.innerHTML = curStory.title ? curStory.title : "notitle"; // HTML probably not necessary for titles
	storyTitleDiv.href = curStory.url;
	storyInfoDiv.innerText = getStoryInfo(curStory);
	storyTextDiv.innerHTML = curStory.text ? curStory.text : "";
	rightPaneDiv.scrollTop = 0;
}

function getStoryInfo(curStory) {
	return `${curStory.score} points by ${curStory.by} ${prettyTimeStr(curStory.time)} | ${curStory.descendants ? curStory.descendants : "0"} comments`
}

function getStoryElem(curStory) {
	let storyDiv = document.createElement("div");

	storyDiv.id = "story-" + curStory.id;
	storyDiv.classList.add("story");

	storyDiv.onclick = function() {
		openStory(curStory);
	};

	storyDiv.innerText += curStory.title;
	storyDiv.innerText += "\n" + getStoryInfo(curStory);

	return storyDiv;
}

function getCommentElem(curComment, atDepth) {
	let commentDiv = document.createElement("div");

	commentDiv.classList.add("comment");
	commentDiv.id = "comment-" + curComment.id;
	commentDiv.style.marginLeft = (atDepth + 1) * commentIndexWidth + "px";

	commentDiv.onmouseover = function() {
		atCommentId = curComment.id;
		updateHash();
	};

	commentDiv.innerHTML += `<u>${curComment.by} ${prettyTimeStr(curComment.time)}</u>`; // also probably not xss safe but css is hard

	let commentTextDiv = document.createElement("div");
	commentTextDiv.style.marginTop = "4px";
	commentTextDiv.innerHTML = !curComment.dead ? curComment.text : "deadcomment"; // not xss safe; nvm? comment with text `test<script>alert(1)</script>` didn't trigger
	commentDiv.appendChild(commentTextDiv);

	return commentDiv;
}

function loadKidsOf(kidIds, ofDepth, ofElem, scrollToHashComment = false) {
	for (let curKidId of kidIds.reverse()) {
		getApi(`item/${curKidId}.json`).then(curComment => {
			if (curComment.deleted) { return; };

			let newCommentElem = getCommentElem(curComment, ofDepth);
			ofElem.after(newCommentElem);
			console.log(`added comment at depth ${ofDepth} by ${curComment.by}`);

			if (curComment.kids) {
				loadKidsOf(curComment.kids, ofDepth + 1, newCommentElem, scrollToHashComment)
			}

			if (scrollToHashComment && curKidId == atCommentId) {
				setTimeout(function() { // delay to allow rendering to occur before scroll attempted (not really a robust solution)
					newCommentElem.scrollIntoView();
					console.log("scrolled to comment");
				}, 1000);
			}
		});
	}
}

function openStory(curStory, scrollToHashComment = false) {
	commentsDiv.innerHTML = "";
	if (curStory.kids) {
		loadKidsOf(curStory.kids, 0, commentsDiv, scrollToHashComment)
	}
	else {
		storyTextDiv.innerHTML = "No comments.";
	}
	displayStory(curStory);
	atStoryId = curStory.id;
	updateHash();
}

function updateHash() {
	window.location.hash = `atstory=${atStoryId}&atcomment=${atCommentId}&sorting=${curSortingType}`;
}

function getHashKey(getKey) { // works fine when all parameter values are super regular
	if (window.location.hash.includes(getKey)) {
		return window.location.hash.split(getKey + "=")[1].split("&")[0];
	}
}

function prettyTimeStr(givenEpoch) {
	let curEpoch = Date.now() / 1000;

	let timeDiff = Math.abs(givenEpoch - curEpoch);

	let timeWord = "";

	if (timeDiff < 1) {
		return "right now";
	}
	else if (timeDiff < 60) { // minute
		timeWord = "second";
	}
	else if (timeDiff < 3600) { // hour
		timeWord = "minute";
		timeDiff /= 60;
	}
	else if (timeDiff < 86400) { // day
		timeWord = "hour";
		timeDiff /= 3600;
	}
	else if (timeDiff < 2678400) { // month
		timeWord = "day";
		timeDiff /= 86400;
	}
	else if (timeDiff < 31536000) { // year
		timeWord = "month";
		timeDiff /= 2678400;
	}

	timeDiff = Math.floor(timeDiff);

	if (timeDiff > 1) {
		timeWord += "s";
	}

	if (givenEpoch > curEpoch) {
		return `in ${timeDiff} ${timeWord}`
	}
	else {
		return `${timeDiff} ${timeWord} ago`
	}
}

function readHash() {
	let hashSortingType = getHashKey("sorting");
	if (hashSortingType) {
		console.log(`hash sorting ${hashSortingType}`);
		curSortingType = hashSortingType;
	}

	let hashAtStoryId = getHashKey("atstory");
	if (hashAtStoryId) {
		console.log(`hash at story ${hashAtStoryId}`);
		atStoryId = parseInt(hashAtStoryId);
	}

	let hashAtCommentId = getHashKey("atcomment");
	if (hashAtCommentId) {
		console.log(`hash at comment ${hashAtCommentId}`);
		atCommentId = parseInt(hashAtCommentId);
	}
}

async function getApi(urlPath) {
	if (cachedReqs[urlPath] != undefined) {
		if (Date.now() - cachedReqs[urlPath].time < maxCacheMinutes * 60 * 1000) {
			return cachedReqs[urlPath].data;
		}
	}

	let fullUrl = "https://hacker-news.firebaseio.com/v0/" + urlPath;

	return fetch(fullUrl)
	.then((response) => response.json())
	.then((apiData) => {
		cachedReqs[urlPath] = {data: apiData, time: Date.now()};
		return apiData;
	});
}