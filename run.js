"use strict"

console.log("running");

let maxCacheMinutes = 5;

let storiesPerLoad = 25;

let atStoryId = 0;
let atCommentId = 0;

let openedStoryTime = 0;

let commentIndexWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--comment-indent-width").replace("px", ""));

let darkModeColorText = getComputedStyle(document.documentElement).getPropertyValue("--dark-mode-color-text");
let darkModeColorBackground = getComputedStyle(document.documentElement).getPropertyValue("--dark-mode-color-bg");
let lightModeColorText = getComputedStyle(document.documentElement).getPropertyValue("--light-mode-color-text");
let lightModeColorBackground = getComputedStyle(document.documentElement).getPropertyValue("--light-mode-color-bg");

let storiesDiv = document.getElementById("stories");
let storyTitleDiv = document.getElementById("storytitle");
let storyInfoDiv = document.getElementById("storyinfo");
let storyTextDiv = document.getElementById("storytext");
let commentsDiv = document.getElementById("commentscontainer");
let rightPaneDiv = document.getElementById("rightpane");

let curSortingType = "top";

let storiesArray = [];
let atStoryInd = 0;

let darkModeSetting = true;

checkDarkModeSettings();

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
	let getApiPromises = [];
	for (let curStoryId of storiesArray.slice(storyFrom, storyTo)) {
		let placeholderDiv = document.createElement("div");
		storiesDiv.appendChild(placeholderDiv);
		getApi(`item/${curStoryId}.json`).then(curStory => {
			let curStoryElem = getStoryElem(curStory);
			placeholderDiv.replaceWith(curStoryElem);
			console.log(`added story by ${curStory.by}`);
		});
	}
}

function displayStory(curStory) { // also probably not xss safe
	storyTitleDiv.innerHTML = curStory.title ? curStory.title : "notitle"; // HTML probably not necessary for titles
	storyTitleDiv.href = curStory.url;
	storyInfoDiv.innerHTML = getStoryInfo(curStory, true);
	storyTextDiv.innerHTML = curStory.text ? curStory.text : "";
	rightPaneDiv.scrollTop = 0;
}

function getStoryInfo(curStory, hyperlinkComments) {
	let storyInfoStr = `${curStory.score} points by ${curStory.by} ${prettyTimeStr(curStory.time)}`;
	storyInfoStr += " | ";
	if (hyperlinkComments) {
		storyInfoStr += `<a href="https://news.ycombinator.com/item?id=${curStory.id}">${curStory.descendants} comments</a>`
	}
	else {
		storyInfoStr += `${curStory.descendants} comments`;
	}
	return storyInfoStr;
}

function getStoryElem(curStory) {
	let storyDiv = document.createElement("div");

	storyDiv.id = "story-" + curStory.id;
	storyDiv.classList.add("story");

	storyDiv.onclick = function() {
		openStory(curStory);
	};

	storyDiv.innerText += curStory.title;
	storyDiv.innerHTML += "<br>" + getStoryInfo(curStory, false);

	return storyDiv;
}

function getCommentElem(curComment, atDepth) {
	let commentDiv = document.createElement("div");

	commentDiv.id = "comment-" + curComment.id;
	commentDiv.classList.add("comment");
	commentDiv.style.marginLeft = commentIndexWidth + "px";

	commentDiv.onmouseover = function() {
		atCommentId = curComment.id;
		updateHash();
	};

	commentDiv.style.zIndex = atDepth.toString(); // doesn't work, onmouseover still only triggers on top-level comment

	commentDiv.innerHTML += `<u><a href="https://news.ycombinator.com/user?id=${curComment.by}">${curComment.by}</a> <a href="https://news.ycombinator.com/item?id=${curComment.id}"><span title="${new Date(curComment.time * 1000).toString()}">${prettyTimeStr(curComment.time)}</span></u></a>`; // also probably not xss safe but css is hard

	let commentTextDiv = document.createElement("div");
	commentTextDiv.style.marginTop = "4px";
	commentTextDiv.innerHTML = !curComment.dead ? curComment.text : "deadcomment"; // not xss safe; nvm? comment with text `test<script>alert(1)</script>` didn't trigger
	commentDiv.appendChild(commentTextDiv);

	return commentDiv;
}

async function loadKidsOf(kidIds, ofStoryId, ofOpenTime, ofDepth, ofElem, scrollToHashComment = false) {
	for (let curKidId of kidIds) {
		await getApi(`item/${curKidId}.json`).then(curComment => {
			if (curComment.deleted) { return; };

			if (ofStoryId != atStoryId) { // prevent loading multiple stories' comments at once
				console.log("wrong story id");
				return;
			}

			if (ofOpenTime != openedStoryTime) { // prevent loading multiple sets of comments for the same story at once
				console.log("wrong story opened time");
				return;
			}

			let newCommentElem = getCommentElem(curComment, ofDepth);
			ofElem.appendChild(newCommentElem);
			console.log(`added comment at depth ${ofDepth} by ${curComment.by}`);

			if (curComment.kids) {
				loadKidsOf(curComment.kids, ofStoryId, ofOpenTime, ofDepth + 1, newCommentElem, scrollToHashComment)
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
	displayStory(curStory);
	atStoryId = curStory.id;
	updateHash();

	openedStoryTime = Date.now();

	commentsDiv.innerHTML = "";
	if (curStory.kids) {
		loadKidsOf(curStory.kids, atStoryId, openedStoryTime, 0, commentsDiv, scrollToHashComment)
	}
	else {
		storyTextDiv.innerHTML = "No comments.";
	}
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
	else {
		timeWord = "year";
		timeDiff /= 31536000;
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

function checkDarkModeSettings() {
	if (getCookie("darkmode") == "true") {
		darkModeSetting = true;
	}
	else if (getCookie("darkmode") == "false") {
		darkModeSetting = false;
	}
	updatePageAppearance()
}

function toggleDarkMode() {
	darkModeSetting = !darkModeSetting;
	setCookie("darkmode", darkModeSetting ? "true" : "false");
	updatePageAppearance();
	console.log(`toggled dark mode to ${darkModeSetting}`);
}

function updatePageAppearance() {
	if (darkModeSetting) {
		document.body.style.color = darkModeColorText;
		document.body.style.backgroundColor = darkModeColorBackground;
	}
	else {
		document.body.style.color = lightModeColorText;
		document.body.style.backgroundColor = lightModeColorBackground;
	}
	console.log(`dark mode set to ${darkModeSetting}`);
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
	let gotCacheStr = window.localStorage.getItem("cache-" + urlPath);
	if (gotCacheStr != undefined) {
		let gotCacheJson = JSON.parse(gotCacheStr);
		if (Date.now() - gotCacheJson.time < maxCacheMinutes * 60 * 1000) {
			return gotCacheJson.data;
		}
	}

	let fullUrl = "https://hacker-news.firebaseio.com/v0/" + urlPath;

	return fetch(fullUrl)
	.then((response) => response.json())
	.then((apiData) => {
		window.localStorage.setItem("cache-" + urlPath, JSON.stringify({data: apiData, time: Date.now()}));
		return apiData;
	});
}

function setCookie(cname, cvalue) { // from w3schools
	const d = new Date();
	d.setTime(d.getTime() + (365*24*60*60*1000)); // 1 year expiry
	let expires = "expires="+ d.toUTCString();
	document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) { // from w3schools
	let name = cname + "=";
	let decodedCookie = decodeURIComponent(document.cookie);
	let ca = decodedCookie.split(';');
	for(let i = 0; i <ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) == ' ') {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length, c.length);
		}
	}
	return "";
}