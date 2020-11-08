import { displayFeedback, renderVideoAccordian } from "./InstructorDashboardRenderVideoInfo.js";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';

function displayVideos(videoObjects) {
    let videoNav = document.getElementById("nav-videos");
    if (videoObjects.status == false) {
        videoNav.innerText = "No videos could be found";
    } {
        renderVideoAccordian(document, videoObjects);
    }
}

window.onload = function() {
    console.log("fucking run plz");
    chrome.runtime.sendMessage({
        type: "FetchVideos"
    }, (response) => {
        console.error(response);
        displayVideos(response);
    });
    let color=["#5959e6", "#800000"];
    let passiveChart = document.getElementById("passiveFeedback").getContext("2d");
    new Chart(passiveChart, {
        type: "line",
        data: {
            datasets: [{
                label: "Passive Feedback",
                borderColor: color[1],
                pointBackgroundColor: color[1],
                pointBorderColor: color[1],
                pointHoverBackgroundColor:color[1],
                pointHoverBorderColor: color[1],
                data: passiveFeedback
            }],
        },
        options: {
            tooltips: {
                callbacks: {
                    title: displayStudents
                }
            },
            scales: {
                xAxes: [{
                    type: "time",
                    distribution: "series",
                    time: {
                        displayFormats: {
                            "millisecond": "h:m:ss",
                            "second": "h:m:ss",
                            "minute": "h:m:ss",
                            "hour": "h:m:ss"
                        },
                    },
                    ticks: {
                        callback: displayFormatFunction
                    },

                }]
            }
        }
    });
    let activeChart = document.getElementById("activeFeedback").getContext("2d");
    new Chart(activeChart, {
        type: "bar",
        data
    });
};
