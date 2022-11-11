console.log("running");

let commentIndexWidth = 32;

initialLoad();

let storiesDiv = document.getElementById("stories");
let commentsDiv = document.getElementById("comments");

async function getApi(urlPath) {
	let fullUrl = "https://hacker-news.firebaseio.com/v0/" + urlPath;

	return fetch(fullUrl)
	.then((response) => response.json())
	.then((apiData) => {
		return apiData;
	});
}

function getStoryElem(curStory) {
	let storyDiv = document.createElement("div");

	storyDiv.classList.add("story");

	storyDiv.onclick = function() {
		commentsDiv.innerHTML = "";
		appendComments(curStory.kids, commentsDiv, 0)
	};

	storyDiv.innerText += curStory.title;
	storyDiv.innerText += `\n${curStory.score} points by ${curStory.by} | ${curStory.descendants ? curStory.descendants : "0"} comments`;

	return storyDiv;
}

function getCommentElem(curComment, atLevel) {
	let commentDiv = document.createElement("div");

	commentDiv.classList.add("comment");
	commentDiv.style.marginLeft = (atLevel + 1) * commentIndexWidth + "px";

	commentDiv.innerText += `${curComment.by} at ${curComment.time}`;

	let commentTextDiv = document.createElement("div");
	commentTextDiv.innerHTML = curComment.text; // not xss safe
	commentDiv.appendChild(commentTextDiv);

	return commentDiv;
}

function appendComments(kidIds, toElement, atLevel) {
	if (!kidIds) { return; };
	for (let curKidId of kidIds) {
		getApi(`item/${curKidId}.json`).then(curComment => {
			if (curComment.dead) { return; };

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