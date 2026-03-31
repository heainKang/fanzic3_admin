import "reflect-metadata";
import { db } from '../database.js';

import PushMessage3 from "../db/push_message3.js";
import admin from 'firebase-admin';
import serviceAccount from '../firebase_key.json' assert { type: "json" }; //firebase-admin 초기화 전용 파일을 하나 만들기

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});     //기존꺼는 되는대 db변경 후 안되어서 새로 만들었음. 2025-07-17

export default admin;

import consoleStamp from 'console-stamp'; // console.log 시간 정보 추가

import { AppDataSource3 } from "../db/data-source3.js";

// 터미널 console.log에 시간표시
consoleStamp(console, ['yyyy/mm/dd HH:MM:ss.l']);


//2025.07.11 푸시알림 테이블 변경
const pushMessageRepository3 = AppDataSource3.getRepository(PushMessage3);


// 관리자가 비밀번호 초기화 시 푸시알림
export async function sendPushNotification(user) {
    try {
        const user_token = user.token_value
        // 토큰 값 확인 후 푸시 알림 전송 시도
        if (user_token !== 'null') {
            try {
                await sendPushNotificationToToken(user);
                console.log("푸시 알림을 성공적으로 보냈습니다.");
            } catch (error) {
                handlePushNotificationError(error, user_token);
                console.log("푸시 알림을 실패했습니다.");
            }
        } else {
            //deleteInvalidUser(user.token_value);
            console.log("nullUser has been deleted.");
            console.log("token 유효하지 않음");
        }
    } catch (error) {
        // Sentry.captureException(error);
        console.error("푸시 알림을 보내는 중 에러가 발생했습니다:", error);
    }
}

// 알림 메세지 보내기
async function sendPushNotificationToToken(user) {
    console.log("메시지 보내기 시작");
    const now = new Date(); // 현재 시간을 가져옵니다.
    const token = user.token_value
    if (!token) {
        console.log("푸시를 보낼 수 없습니다. 사용자 token 없음");
        return;
    }
    console.log("message start time ::", now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    // const getUserIdSql = 
    //         `SELECT *
    //         FROM User
    //         WHERE token_value = ? and device_type = 'i';`;
    // // Get userId
    // const userIdResult = await db.execute(getUserIdSql, [token]);
    // const userId = userIdResult[0];
    let badgeCount = 0;
    // if (user.device_type == 'i') {
    //     badgeCount = await calculateBadgeCountForUser(user.id);
    //     console.log("BadgeCount = ", badgeCount)
    // }
    const message = {
        "token": token,
        "notification": {
            "title" : '비밀번호 초기화 알림',
            "body" : `관리자가 비밀번호를 초기화 하였습니다.`,
        },
        android: {
            priority: 'high',
            notification: {
            sound: 'default'
            }
        },
        // apns: {  // iOS 설정 부분
        //     payload: {
        //         aps: {
        //             alert: {
        //                 title: '예약 꺼짐 알림입니다.',
        //                 body: `${fanName}이(가) 꺼졌습니다`
        //             },
        //             badge: badgeCount, // 배지 상태를 제어하는 부분
        //             sound: 'default'
        //         }
        //     }
        // }
    }

    const pushContent = message.notification.body;
    //2025.07.11 푸시알림 테이블 변경
 //   const newPushMessage = pushMessageRepository.create({ messageContent: pushContent, userId: user.id });
 //   const savePushMessage = await pushMessageRepository.save(newPushMessage);
 //   console.log("저장된 푸시메시지 = ", savePushMessage);

 //   await admin.messaging().send(message).then((response) => {
 //       console.log('FCM Response ::', response);
 //   });

    const newPushMessage = pushMessageRepository3.create({ messageContent: pushContent, userId: user.id });
    const savePushMessage = await pushMessageRepository3.save(newPushMessage);
    console.log("저장된 푸시메시지 = ", savePushMessage);

    await admin.messaging().send(message).then((response) => {
        console.log('FCM Response ::', response);
    });

    const endTime = new Date(); // 메시지 전송이 완료된 후 시간을 가져옵니다.
    console.log("message end time ::", endTime.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}


// 사용자별로 알림 카운트를 계산하는 함수
async function calculateBadgeCountForUser(user_id) {
    // 예: 데이터베이스에서 해당 사용자의 알림 개수를 가져오기
    try {
        const badgeCountSql = 
            `SELECT badge_count FROM BadgeCount WHERE user_id = ?;`;

        const badgeCount = await db.execute(badgeCountSql, [user_id]).then((result) => result[0]);
            
        if (Number(badgeCount.length) > 0) {
            const newCount = Number(badgeCount[0].badge_count + 1)
            const countPlusSql = `UPDATE BadgeCount SET badge_count = ? WHERE user_id = ?`;          
            await db.execute(countPlusSql, [newCount, user_id]).then((result) => "success");
            console.log("BadgeCount has been updated.");
            
            return newCount;        
        } else {
            const firstCountSql = `INSERT INTO BadgeCount (user_id, badge_count) values (?, 1);`
            await db.execute(firstCountSql, [user_id]).then((result) => "success");
            console.log("FirstCount has been registered.");

            const firstCount = 1;
            return firstCount;
        }
    } catch (error) {
        console.log(error);
    }
}

// 토큰값에 따른 에러 처리
function handlePushNotificationError(error, token) {
    console.log(error.code)
    if (error.code === 'messaging/registration-token-not-registered') {
        console.log("등록되지 않은 토큰입니다. ::", token);
        // deleteInvalidUser(token);
        console.log("User has been deleted.");
    } else if(error.code === 'messaging/mismatched-credential') {
        // deleteInvalidUser(token);
        console.log("FCM 발신자가 다릅니다. ::", token);
    } else if(error.code ==='messaging/third-party-auth-error') {
        // deleteInvalidUser(token);
        console.log("외부테스터입니다. ::", token);
    }  else {
        console.error("푸시 알림을 보내는 중 에러가 발생했습니다. ::", error);
    }
}
/*
// 토큰값이 유효하지 않은 유저 삭제
function deleteInvalidUser(token) {
    const deleteUserSql = `
        delete
        from User
        where token_value = ?;`;
    db.execute(deleteUserSql, [token]).then((result) => result[0]);
}
*/