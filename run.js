"use strict"

console.log("running");

let commentIndexWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--comment-indent-width").replace("px", ""));

initialLoad();

let storiesDiv = document.getElementById("stories");

let storyTitleDiv = document.getElementById("storytitle");
let storyInfoDiv = document.getElementById("storyinfo");
let storyTextDiv = document.getElementById("storytext");
let commentsDiv = document.getElementById("comments");

async function getApi(urlPath) {
	let fullUrl = "https://hacker-news.firebaseio.com/v0/" + urlPath;

	return fetch(fullUrl)
	.then((response) => response.json())
	.then((apiData) => {
		return apiData;
	});
}

function displayStory(curStory) { // also probably not xss safe
	storyTitleDiv.innerHTML = curStory.title ? curStory.title : "notitle"; // HTML probably not necessary for titles
	storyTitleDiv.href = curStory.url;
	storyInfoDiv.innerText = getStoryInfo(curStory);
	storyTextDiv.innerHTML = curStory.text ? curStory.text : ""; 
}

function getStoryInfo(curStory) {
	return `${curStory.score} points by ${curStory.by} ${prettyTimeStr(curStory.time)} | ${curStory.descendants ? curStory.descendants : "0"} comments`
}

function getStoryElem(curStory) {
	let storyDiv = document.createElement("div");

	storyDiv.classList.add("story");

	storyDiv.onclick = function() {
		commentsDiv.innerHTML = "";
		appendComments(curStory.kids, commentsDiv, 0);
		displayStory(curStory);
	};

	storyDiv.innerText += curStory.title;
	storyDiv.innerText += "\n" + getStoryInfo(curStory);

	return storyDiv;
}

function getCommentElem(curComment, atLevel) {
	let commentDiv = document.createElement("div");

	commentDiv.classList.add("comment");
	commentDiv.style.marginLeft = (atLevel + 1) * commentIndexWidth + "px";

	commentDiv.innerText += `${curComment.by} ${prettyTimeStr(curComment.time)}`;

	let commentTextDiv = document.createElement("div");
	commentTextDiv.innerHTML = !curComment.dead ? curComment.text : "deadcomment"; // not xss safe; nvm? comment with text `test<script>alert(1)</script>` didn't trigger
	commentDiv.appendChild(commentTextDiv);

	return commentDiv;
}

function appendComments(kidIds, toElement, atLevel) {
	if (!kidIds) { return; };
	for (let curKidId of kidIds) {
		getApi(`item/${curKidId}.json`).then(curComment => {
			if (curComment.deleted) { return; };

			let newCommentElem = getCommentElem(curComment, atLevel);
			toElement.appendChild(newCommentElem);
			console.log(`added comment by ${curComment.by}`);

			appendComments(curComment.kids, newCommentElem, atLevel + 1);
		});
	}
}

function initialLoad() {
	getApi("topstories.json").then(topStories => {
	console.log(`got ${topStories.length} top stories`);

	for (let curStoryId of topStories.slice(0, 50)) {
			getApi(`item/${curStoryId}.json`).then(curStory => {
				storiesDiv.appendChild(getStoryElem(curStory));
				console.log(`added story by ${curStory.by}`);
			});
		}
	});
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