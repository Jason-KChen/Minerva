import express from "express";
import {
    client,
    incrAsync,
    incrByAsync,
    keysAsync,
    lrangeAsync,
    mgetAsync,
    setAsync,
    watchAsync
} from "../utils/Redis.js";
import { isNullOrUndefined, includesNullOrUndefined } from "../utils/ValueChecker.js";

const router = express.Router();

router.get("/getAllStudentTime", async function (req, res) {
    let status = true;
    let studentInfo = null;

    try {
        let searchPattern = "*-time";
        let foundKeys = await keysAsync(searchPattern);
        let studentTimes = await mgetAsync(foundKeys);

        studentInfo = studentTimes.map((time, index) => {
            let correspondingKey = foundKeys[index];
            let name = correspondingKey.replace("-time", "");

            return {
                name,
                "time": parseInt(time)
            };
        });
    } catch (e) {
        console.error(`[Endpoint] getAllStudentTime failed, ${e}`);
        status = false;
    }

    res.json({status, studentInfo});
});

router.get("/getStudentProfile", async function (req, res) {
    let status = true;
    let studentName = req.query["student_name"];
    let timeRecord = null;
    let coinBalance = null;
    let correctCount = -1;
    let incorrectCount = -1;
    let ownedBadges = [];

    try {
        if (isNullOrUndefined(studentName)) {
            throw new Error("Incomplete parameters");
        }

        let keys = [
            `${studentName}-time`,
            `${studentName}-balance`,
            `${studentName}-correct-question-count`,
            `${studentName}-incorrect-question-count`
        ];

        let result = await mgetAsync(keys);
        timeRecord = parseInt(result[0]);
        coinBalance = parseInt(result[1]);
        correctCount = parseInt(result[2]);
        incorrectCount = parseInt(result[3]);

        let badgeKey = `${studentName}-owned-badges`;
        ownedBadges = await lrangeAsync(badgeKey, 0, -1);
    } catch (e) {
        console.error(`[Endpoint] getStudentBalance failed, ${e}`);
        status = false;
    }

    res.json({
        status,
        "time_record": timeRecord,
        "coin_balance": coinBalance,
        "correct_count": correctCount,
        "incorrect_count": incorrectCount,
        "owned_badges": ownedBadges
    });
});

router.post("/finishVideo", async function (req, res) {
    let status = true;
    let newBalance = null;
    let newTime = null;
    let actualCoinIncrement = null;
    let studentName = req.body["student_name"];
    let newIncrement = req.body["increment"];
    let videoID = req.body["videoID"];

    try {
        if (includesNullOrUndefined([studentName, newIncrement, videoID])) {
            throw new Error("Incomplete parameters");
        }

        let watchTimesKey = `${videoID}-${studentName}-watch-times`;
        let newWatchTimes = await incrAsync(watchTimesKey);
        let discountedIncrement = Math.trunc(newIncrement / newWatchTimes);
        actualCoinIncrement = discountedIncrement;
        let balanceResult = await incrByAsync(`${studentName}-balance`, discountedIncrement);
        let timeResult = await incrByAsync(`${studentName}-time`, discountedIncrement);

        newBalance = parseInt(balanceResult);
        newTime = parseInt(timeResult);
        console.log(`[Endpoint] ${studentName} now has watched ${videoID} ${newWatchTimes} times, awarded with ${discountedIncrement} as compared to original amount ${newIncrement}`);
    } catch (e) {
        console.error(`[Endpoint] addStudentBalance failed, ${e}`);
        status = false;
    }

    res.json({
        status,
        newBalance,
        newTime,
        "earned_amount": actualCoinIncrement
    });
});

router.post("/purchaseSticker", async function (req, res) {
    let status = true;
    let studentName = req.body["student_name"];
    let stickerName = req.body["sticker_name"];
    let price = req.body["price"];

    try {
        if (includesNullOrUndefined([studentName, stickerName, price])) {
            throw new Error("Incomplete parameters");
        }
        
        let studentBalanceKey = `${studentName}-balance`;
        let studentStickerKey = `${studentName}-owned-badges`;
        // Start a transaction
        await watchAsync(studentBalanceKey, studentStickerKey);
        let balance = await mgetAsync(studentBalanceKey);
        let ownedStickers = await lrangeAsync(studentStickerKey, 0, -1);

        // Check for the conditions
        if (balance[0] < price || ownedStickers.includes(stickerName)) {
            throw new Error("Insufficient balance or duplicate sticker");
        }

        let result = await new Promise((resolve, reject) => {
            client.multi()
                .decrby(studentBalanceKey, price)
                .rpush(studentStickerKey, stickerName)
                .exec((error, reply) => {
                    if (error || !reply) {
                        reject(error);
                    }

                    resolve(reply);
                });
        });

        console.log("[Endpoint] purchaseSticker executed with following output");
        console.log(result);
    } catch (e) {
        console.error(`[Endpoint] purchaseSticker failed, ${e}`);
        status = false;
    }

    res.json({ status });
});

router.post("/answerQuestionCorrect", async function (req, res) {
    let status = true;
    let discountAmount = null;
    let studentName = req.body["student_name"];
    let videoID = req.body["videoID"];

    try {
        if (includesNullOrUndefined([studentName, videoID])) {
            throw new Error("Incomplete parameters");
        }

        let totalCorrectCountKey = `${studentName}-correct-question-count`;
        await incrAsync(totalCorrectCountKey);

        let videoCorrectCountKey = `${studentName}-${videoID}-correct-question-count`;
        let videoCorrectCountVal = await incrAsync(videoCorrectCountKey);

        discountAmount = Math.trunc(5000 / videoCorrectCountVal);
        let studentBalanceKey = `${studentName}-balance`;
        let newBalance = await incrByAsync(studentBalanceKey, discountAmount);

        console.log(`[Endpoint] ${studentName} correctly answered a question on ${videoID}, awarded with ${discountAmount} and the new balance is ${newBalance}`);
    } catch (e) {
        console.error(`[Endpoint] answerQuestionCorrect failed, ${e}`);
        status = false;
    }

    res.json({
        status,
        "earned_amount": discountAmount
    });
});

router.post("/answerQuestionIncorrect", async function (req, res) {
    let status = true;
    let studentName = req.body["student_name"];

    try {
        if (isNullOrUndefined(studentName)) {
            throw new Error("Incomplete parameters");
        }

        let key = `${studentName}-incorrect-question-count`;
        let incorrectCount = await incrAsync(key);
        console.log(`[Endpoint] ${studentName} answered a question incorrectly, total count ${incorrectCount}`);
    } catch (e) {
        console.error(`[Endpoint] answerQuestionIncorrect failed, ${e}`);
        status = false;
    }

    res.json({ status });
});

router.post("/saveStudentFreeHours", async function (req, res) {
    let status = true;
    let studentName = req.body["student_name"];
    let freeHourStart = req.body["hour_start"];
    let freeHourEnd = req.body["hour_end"];

    try {
        if (includesNullOrUndefined([studentName, freeHourStart, freeHourEnd])) {
            throw new Error("Incomplete parameters");
        }

        let key = `${studentName}-free-hour`;
        let val = `${freeHourStart}-<>-${freeHourEnd}`;
        await setAsync(key, val);

        console.log(`[Endpoint] saved new free hours for ${studentName}, from ${freeHourStart} to ${freeHourEnd}`);
    } catch (e) {
        console.error(`[Endpoint] saveStudentFreeHours failed, ${e}`);
        status = false;
    }

    res.json({ status });
});

router.get("/getStudentFreeHours", async function (req, res) {
    let status = true;
    let studentName = req.query["student_name"];
    let freeHourStart = null;
    let freeHourEnd = null;

    try {
        if (isNullOrUndefined(studentName)) {
            throw new Error("Incomplete parameters");
        }

        let key = `${studentName}-free-hour`;
        let result = await mgetAsync(key);
        let splitRes = result[0].split("-<>-");
        freeHourStart = parseInt(splitRes[0]);
        freeHourEnd = parseInt(splitRes[1]);
    } catch (e) {
        console.error(`[Endpoint] getStudentFreeHours failed, ${e}`);
        status = false;
    }

    res.json({
        status,
        "hour_start": freeHourStart,
        "hour_end": freeHourEnd
    });
});

export { router as StudentRouter };
