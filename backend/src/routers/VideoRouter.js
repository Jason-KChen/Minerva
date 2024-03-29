import { promisify } from "util";
import { exec } from "child_process";
import express from "express";
import { incrAsync, keysAsync, lrangeAsync, mgetAsync, rpushAsync, setAsync } from "../utils/Redis.js";
import { isNullOrUndefined, includesNullOrUndefined } from "../utils/ValueChecker.js";
const execAsync = promisify(exec);
const router = express.Router();

router.post("/saveVideoInfo", async function (req, res) {
    let status = true;
    let videoID = req.body.videoID;
    let videoName = req.body.video_name;
    let videoDuration = req.body.video_duration;

    try {
        if (includesNullOrUndefined([videoID, videoName, videoDuration])) {
            throw new Error("Incomplete parameters");
        }

        let videoInfoKey = `${videoID}-video-info`;
        let videoInfoVal = `${videoName}-<>-${videoDuration}`;
        await setAsync(videoInfoKey, videoInfoVal);
        console.log(`[Endpoint] sets ${videoInfoKey} with ${videoInfoVal}`);
    } catch (e) {
        console.error(`[Endpoint] saveVideoInfo failed, ${e}`);
        status = false;
    }

    res.json({ status });
});

router.get("/getAllVideoInfo", async function (req, res) {
    let status = true;
    let videoInfo = [];
    try {
        let videoInfoKeyPattern = "*-video-info";
        let foundVideoInfoKeys = await keysAsync(videoInfoKeyPattern);
        let foundVideoInfo = await mgetAsync(foundVideoInfoKeys);
        videoInfo = foundVideoInfoKeys.map((key, index) => {
            let correspondingVideoInfo = foundVideoInfo[index];
            let parsedKey = key.replace("-video-info", "");
            let parsedVideoInfo = correspondingVideoInfo.split("-<>-");

            return {
                "videoID": parsedKey,
                "video_title": parsedVideoInfo[0],
                "video_duration": parseInt(parsedVideoInfo[1])
            };
        });

        console.log(`[Endpoint] Found ${foundVideoInfoKeys.length} in Redis`);
    } catch (e) {
        console.error(`[Endpoint] getAllVideoInfo failed, ${e}`);
        status = false;
    }

    res.json({
        status,
        "video_info": videoInfo
    });
});

// Add question timestamp based on given video ID
router.post("/addActiveQuestion", async function (req, res) {
    let status = true;
    let studentName = req.body.student_name;
    let videoID = req.body.videoID;
    let timestamp = req.body.timestamp;
    let questionText = req.body.question_text;

    try {
        if (includesNullOrUndefined([studentName, videoID, timestamp, questionText])) {
            throw new Error("Incomplete parameters");
        }

        let counterKey = `${videoID}-active-questions-${timestamp}`;
        let newCount = await incrAsync(counterKey);
        let questionKey = `${videoID}-active-questions-text`;
        let questionVal = `${studentName}-<>-${timestamp}-<>-${questionText}`;
        let result = await rpushAsync(questionKey, questionVal);
        console.log(`[Endpoint] incremented ${counterKey}, new length is ${newCount}`);
        console.log(`[Endpoint] Appended ${questionVal} to ${questionKey}, new length is ${result}`);
    } catch (e) {
        console.error(`[Endpoint] addActiveQuestion failed, ${e}`);
        status = false;
    }

    res.json({ status });
});

router.post("/addPassiveQuestion", async function (req, res) {
    let status = true;
    let studentName = req.body.student_name;
    let videoID = req.body.videoID;
    let timestamp = req.body.timestamp;

    try {
        if (includesNullOrUndefined([studentName, videoID, timestamp])) {
            throw new Error("Incomplete parameters");
        }

        let counterKey = `${videoID}-passive-questions-${timestamp}`;
        let newCount = await incrAsync(counterKey);
        console.log(`[Endpoint] incremented ${counterKey}, new length is ${newCount}`);
    } catch (e) {
        console.error(`[Endpoint] addPassiveQuestion failed, ${e}`);
        status = false;
    }

    res.json({ status });
});

// Get all timestamps associated with a video
router.get("/getAllQuestions", async function (req, res) {
    let status = true;
    let activeQuestions = [];
    let activeQuestionText = [];
    let passiveQuestions = [];
    let videoID = req.query.videoID; 

    try {
        if (isNullOrUndefined(videoID)) {
            throw new Error("Incomplete parameters");
        }

        // Grab all passive questions
        let passiveQuestionKeyPattern = `${videoID}-passive-questions-*`;
        let foundPassiveQuestionKeys = await keysAsync(passiveQuestionKeyPattern);
        if (foundPassiveQuestionKeys.length > 0) {
            let foundPassiveQuestionVals = await mgetAsync(foundPassiveQuestionKeys);

            passiveQuestions = foundPassiveQuestionKeys.map((key, index) => {
                let correspondingCounter = foundPassiveQuestionVals[index];
                let timestamp = key.replace(`${videoID}-passive-questions-`, "");

                return {
                    "timestamp": parseInt(timestamp),
                    "count": parseInt(correspondingCounter)
                };
            });
        }
        
        // Grab all active questions
        let activeQuestionKeyPattern = `${videoID}-active-questions-*`;
        let foundActiveQuestionKeys = await keysAsync(activeQuestionKeyPattern);
        if (foundActiveQuestionKeys.length > 0) {
            let foundActiveQuestionVals = await mgetAsync(foundActiveQuestionKeys);

            activeQuestions = foundActiveQuestionKeys.map((key, index) => {
                let correspondingCounter = foundActiveQuestionVals[index];
                let timestamp = key.replace(`${videoID}-active-questions-`, "");

                return {
                    "timestamp": parseInt(timestamp),
                    "count": parseInt(correspondingCounter)
                };
            });
        }

        // Grab texual questions
        let activeTextQuestionKey = `${videoID}-active-questions-text`;
        let condensedQuestions = await lrangeAsync(activeTextQuestionKey, 0, -1);
        
        activeQuestionText = condensedQuestions.map((value) => {
            let splitted = value.split("-<>-");

            return {
                "name": splitted[0],
                "timestamp": parseInt(splitted[1]),
                "text": splitted[2]
            };
        });
    } catch (e) {
        console.error(`[Endpoint] getAllQuestions failed, ${e}`);
        status = false;
    }

    res.json({
        status,
        "active_questions": activeQuestions,
        "active_questions_text": activeQuestionText,
        "passive_question": passiveQuestions
    });
});

router.get("/getPostLectureQuestions", async function (req, res) {
    let status = true;
    let questionText = null;
    let correctAnswer = null;
    let wrongOptionOne = null;
    let wrongOptionTwo = null;
    let videoID = req.query.videoID; 

    try {
        if (isNullOrUndefined(videoID)) {
            throw new Error("Incomplete parameters");
        }

        let key = `${videoID}-post-lecture-question`;
        let val = await mgetAsync([key]);
        if (val.length === 0) {
            throw new Error(`Questions Not found for ${videoID}`);
        }

        let parsedResult = val[0].split("-<>-");
        questionText = parsedResult[0];
        correctAnswer = parsedResult[1];
        wrongOptionOne = parsedResult[2];
        wrongOptionTwo = parsedResult[3];
    } catch (e) {
        console.error(`[Endpoint] getPostLectureQuestions failed, ${e}`);
        status = false;
    }

    res.json({
        status,
        "question": questionText,
        "correct_answer": correctAnswer,
        "wrong_answer_one": wrongOptionOne,
        "wrong_answer_two": wrongOptionTwo
    });
});

router.post("/AddPostLectureQuestions", async function (req, res) {
    let status = true;
    let videoID = req.body.videoID;
    let question = req.body.question;
    let correct = req.body.correct;
    let wrong = req.body.wrong;
    let anotherWrong = req.body["another_wrong"];

    try {
        if (includesNullOrUndefined([videoID, question, correct, wrong, anotherWrong])) {
            throw new Error("Incomplete parameters");
        }

        let key = `${videoID}-post-lecture-question`;
        let value = `${question}-<>-${correct}-<>-${wrong}-<>-${anotherWrong}`;
        await setAsync(key, value);

        console.log(`[Endpoint:AddPostLectureQuestions] set ${value} to ${key}`);
    } catch (e) {
        console.error(`[Endpoint] AddPostLectureQuestions failed, ${e}`);
        status = false;
    }

    res.json({ status });
});

router.get("/getVideoContextKeywords", async function (req, res) {
    let status = true;
    let videoID = req.query["videoID"];
    let timestamp = req.query["timestamp"];
    let duration = req.query["duration"];
    let result = null;

    try {
        if (includesNullOrUndefined([videoID, timestamp, duration])) {
            throw new Error("Incomplete parameters");
        }
        let rawResult = await execAsync(`./py_scripts/env/bin/python ./py_scripts/keyword_extraction.py ${videoID} ${timestamp} ${duration}`);
        console.log(rawResult);
        result = JSON.parse(rawResult.stdout); 
    } catch (e) {
        console.error(`[Endpoint] getVideoContextKeywords failed, ${e}`);
        status = false;
    }

    res.json({
        status,
        data: result
    });
});

router.get("/getVideoStudentStats", async function (req, res) {
    let status = true;
    let videoID = req.query["videoID"];
    let data = null;

    try {
        if (isNullOrUndefined(videoID)) {
            throw new Error("Incomplete parameters");
        }

        let balancePattern = "*-balance";
        let allStudentsBalanceKeys = await keysAsync(balancePattern);
        let allStudentNames = allStudentsBalanceKeys.map((e) => {
            return e.replace("-balance", "");
        });

        let allStudentWatchKeys = allStudentNames.map((e) => {
            return `${videoID}-${e}-watch-times`;
        });

        let allStudentVideoQuestionKeys = allStudentNames.map((e) => {
            return `${e}-${videoID}-correct-question-count`;
        });

        let allStudentWatchVals = await mgetAsync(allStudentWatchKeys);
        let allStudentVideoQuestionVals = await mgetAsync(allStudentVideoQuestionKeys);
        
        data = allStudentVideoQuestionVals.map((e, index) => {
            return {
                "student_name": allStudentNames[index],
                "watch_times": parseInt(allStudentWatchVals[index] ? allStudentWatchVals[index] : 0),
                "question_correct_time": parseInt(e ? e : 0)
            };
        });
    } catch (e) {
        console.error(`[Endpoint] getVideoStudentStats failed, ${e}`);
        status = false;
    }

    res.json({
        status,
        data
    });

});

export { router as VideoRouter };
