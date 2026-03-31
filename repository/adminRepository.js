import "reflect-metadata";
// 25.07.01 추가 실링팬 관리자 통계페이지 
import { AppDataSource3 } from '../db/data-source3.js';

import { db } from '../database.js';

import { startOfWeek, endOfWeek, eachWeekOfInterval, subWeeks, subDays, format, startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';
import { sendPushNotification } from "./pushRepository.js";
import nodemailer from 'nodemailer';
// import { utcToZonedTime } from 'date-fns-tz';
import bcrypt from 'bcrypt';



// 25.07.01 Fanzic DB 추가 실링팬 관리자 통계페이지 
import User3 from "../db/user3.js";     //스크립트가 대소문자만으로 혼란으로 계속 오류가 발생해서 3으로 변경
import Admin3 from "../db/admin3.js";

import VentilFanControlLog from "../db/ventil_fan_control_log.js";
import CeilingFanControlLog from "../db/ceiling_fan_control_log.js";
import Notice from '../db/notice.js';
const userRepository3 = AppDataSource3.getRepository(User3);
const adminRepository3 = AppDataSource3.getRepository(Admin3);
const VentilFanControlLogRepository = AppDataSource3.getRepository(VentilFanControlLog);
const CeilingFanControlLogRepository = AppDataSource3.getRepository(CeilingFanControlLog);

// ========================================
// 📊 관리자 - 관리자정보
// ========================================

// 관리자 등록
export async function registerAdmin(info) {
    try {
        const admin = await adminRepository3.findOne({ where: {admin_id: info.adminID }});
        if (admin) {
            return { status: 'exists', message: 'admin already exists', admin };
        } else {
            const password = info.password = bcrypt.hashSync(info.password, 10);
            const newAdmin = adminRepository3.create({
                admin_id : info.adminID,
                password : password,
                name: info.name,
                email: info.email
            });
            await adminRepository3.save(newAdmin).then(admin => {
                console.log("Admin has been saved: ", admin);
            }).catch(error => {
                 console.error("Error: ", error);
            });
        }
        return "success"
    } catch (error) {
        console.log(error);
    }   
}

// 관리자 비밀번호 변경
export async function modifyAdminPassword(admin_id, info) {
    try {
        const admin = await adminRepository3.findOne({ where: {admin_id: admin_id }});
        const password = bcrypt.hashSync(info.password, 10);
        console.log(admin);
        if (admin) {
            console.log(password);
            admin.password = password;
            const updatedAdmin = await adminRepository3.save(admin);
            console.log("User has been updated", updatedAdmin);
            return "success";
        } else {
            return "no admin";                    
        }
    } catch (error) {
        console.log(error);
    }   
}

// 로그인
export async function login(info) {
    try {
        console.log("id =", info.adminID);
        const admin = await adminRepository3.findOne({ where: { admin_id: info.adminID } });
        console.log("admin = ", admin);
        if (admin) {
            return {
                cnt: 1,  // 찾았으므로 1
                id: admin.id, 
                password: admin.password
            };
        } else {
            return {
                cnt: 0,  // 찾지 못했으므로 0
                id: null,
                admin_id: null,
                password: null
            };
        }
    }catch (error) {
        console.log(error);
    }
}

// ========================================
// 📊 관리자 - 사용자정보
// ========================================



// ✅ 사용자정보 - 1. 정보 조회 (전체 + 유저별 + 팬별)
export async function allUserInfo({ userId, page = 1, limit = 10 }) {
    try {
      const offset = (page - 1) * limit;
  
      // whereClause 동적 생성
      let whereClause = '';
      if (userId) {
        whereClause = `WHERE u.username = '${userId}' OR u.name = '${userId}'`;
      }

      // 팬 통합 count 쿼리 (userId 조건 포함)
      const countSql = `
        SELECT COUNT(*) AS total FROM Fanzic.user u
        ${whereClause};
      `;
      
      const totalResult = await AppDataSource3.query(countSql);
      const total = totalResult[0]?.total || 0;
      
      // 실제 데이터 가져오기
      const sql = `
            SELECT 
                userID, name, phoneNumber, address, 
                SUM(fanCount) AS fanCount, 
                MIN(buyDate) AS buyDate
            FROM (
                -- ventil (유동팬)
                SELECT 
                    u.id AS user_idx, 
                    u.username AS userID, 
                    u.name, 
                    u.phone_number AS phoneNumber, 
                    u.adr AS address,
                    COUNT(DISTINCT vf.id) AS fanCount, 
                    u.created_at AS buyDate
                FROM 
                    Fanzic.user u
                LEFT JOIN 
                    Fanzic.ventil_fan vf 
                    ON vf.user_id = u.id AND vf.deleted_flag = 0
                ${whereClause}
                GROUP BY u.id

                UNION ALL

                -- ceiling (실링팬)
                SELECT 
                    u.id AS user_idx, 
                    u.username AS userID, 
                    u.name, 
                    u.phone_number AS phoneNumber, 
                    u.adr AS address,
                    COUNT(DISTINCT cf.id) AS fanCount, 
                    u.created_at AS buyDate
                FROM 
                    Fanzic.user u
                LEFT JOIN 
                    Fanzic.ceiling_house ch 
                    ON ch.user_id = u.id AND ch.deleted_flag = 0
                LEFT JOIN 
                    Fanzic.ceiling_gate cg 
                    ON cg.house_id = ch.id
                LEFT JOIN 
                    Fanzic.ceiling_fan cf 
                    ON cf.gate_id = cg.id AND cf.deleted_flag = 0
                ${whereClause}
                GROUP BY u.id
            ) AS combined
            GROUP BY userID, name, phoneNumber, address
            ORDER BY buyDate, userID
            LIMIT ${offset}, ${limit};
      `;
  
      const posts = await db.query(sql).then(result => result[0]);
  
      // 번호 매기기
      const numberedPosts = posts.map((post, index) => ({
        no: offset + index + 1,
        ...post,
      }));
  
      // 페이지 계산
      const totalPages = Math.ceil(total / limit);
      const pageUnit = 5;
      const startPage = Math.floor((page - 1) / pageUnit) * pageUnit + 1;
      const endPage = Math.min(startPage + pageUnit - 1, totalPages);
  
      return {
        posts: numberedPosts,
        page,
        limit,
        total,
        totalPages,
        startPage,
        endPage,
      };
    } catch (err) {
      console.error("allUserInfo 오류:", err);
      throw err;
    }
}

// ✅ 사용자정보 - 2. 유저별 팬 상세 조회
export async function fanDetail(info) {
    console.log("요청 들어옴: fanDetail", info);

    const fanSql = `
         SELECT
            (@rownum := @rownum + 1) AS no,
            fan_id,
            fan_name,
            mac_address,
            ssid,
            buyDate,
            fanType
        FROM (
            -- 유동팬
            SELECT 
                f.id AS fan_id,
                f.name AS fan_name,
                f.created_at AS buyDate,
                f.mac_adr AS mac_address,
                f.fan_ssid AS ssid,
                '유동팬' AS fanType
            FROM
                Fanzic.user u
            INNER JOIN 
                Fanzic.ventil_house h ON u.id = h.user_id
            INNER JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            INNER JOIN 
                Fanzic.ventil_fan f ON fgm.fan_id = f.id
            WHERE
                (u.username = ? OR u.name = ?)
                AND f.deleted_flag = 0

            UNION ALL

            -- 실링팬
            SELECT 
                f.id AS fan_id,
                f.name AS fan_name,
                f.created_at AS buyDate,
                gate.mac_adr AS mac_address,
                gate.ssid AS ssid,
                '실링팬' AS fanType
            FROM
                Fanzic.user u
            INNER JOIN 
                Fanzic.ceiling_house ch ON u.id = ch.user_id
            INNER JOIN 
                Fanzic.ceiling_gate gate ON gate.house_id = ch.id
            INNER JOIN 
                Fanzic.ceiling_fan f ON f.gate_id = gate.id
            WHERE
                (u.username = ? OR u.name = ?)
                AND f.deleted_flag = 0
        ) AS fans, (SELECT @rownum := 0) r
        ORDER BY buyDate DESC, fan_id DESC;
    `;

    const result = await AppDataSource3.query(fanSql, [
        info.userId, info.userId,
        info.userId, info.userId
    ]);

    console.log("fanDetail result:", result);
    return result;
}

// ✅ 사용자정보 - 3. 유저별 회원정보 조회
export async function userDetail(info) {
    console.log("요청 들어옴: userDetail", info);
    console.log("info.userId =", info.userId);

    const usersSql = `
        SELECT 
            u.id,
            u.username as userID,
            u.password,
            u.name,
            u.email,
            u.phone_number AS phoneNumber,
            u.adr AS address,
            u.detail_adr AS detailAddress,
            u.standard_rate,
            u.birth_date AS birthday,
            u.company,
            u.company_adr AS companyAddress,
            u.company_detail_adr AS companyDetailAddress,
            u.company_contact AS companyContact,
            u.buyer,
            u.buy_date AS buyDate,
            u.alarm_flag AS alarmFlag
        FROM 
            Fanzic.user u
        WHERE 
            u.username = ? OR u.name = ?;
    `;

    const result = await AppDataSource3.query(usersSql, [info.userId, info.userId]);
    console.log("userDetail result:", result);
    return result;
}

// ✅ 사용자정보 - 4. 유저별 회원정보 수정
export async function modifyUser({ userId, updateData }) {
    try {

        console.log("modifyUser data:", userId, updateData);

        const columnMap = {
            name: "name",
            email: "email",
            phoneNumber: "phone_number",
            address: "adr",
            detailAddress: "detail_adr",
            standard_rate: "standard_rate",
            birthday: "birth_date",
            company: "company",
            companyAddress: "company_adr",
            companyDetailAddress: "company_detail_adr",
            companyContact: "company_contact",
            buyer: "buyer",
            buyDate: "buy_date",
            alarmFlag: "alarm_flag"
        };

        const fields = Object.keys(updateData).filter(key => columnMap[key]);
        const values = fields.map(key => updateData[key]);

        if (fields.length === 0) {
            throw new Error("수정할 필드가 없습니다.");
        }

        const setClause = fields.map(key => `${columnMap[key]} = ?`).join(', ');

        const sql = `
            UPDATE Fanzic.user
            SET ${setClause}
            WHERE username = ?;
        `;

        //console.log("실행 쿼리:", sql, [...values, userId]);

        const result = await AppDataSource3.query(sql, [...values, userId]);
        //MySQL 드라이버(mysql2) 가 자동으로 돌려주는 표준 결과
        //console.log("modifyUser result ===> ", result);
        //return result;
        return "success";

    } catch (error) {
        console.log("❌ modifyUser query error:", error);
        throw error;
    }
}

// ✅ 사용자정보 - 5. 유저별 회원정보 삭제
export async function deleteUser(userId) {
    //console.log("deleteUser 유저 삭제  userId:", userId);

    const result = await AppDataSource3
        .getRepository("user")
        .createQueryBuilder()
        .delete()
        .where("username = :userId", { userId })    //유저로만
        .execute();

    //console.log("deleteUser 유저 삭제 result:", result);
    //return result;
    return "success";
}

// ✅ 사용자정보 - 6. 유저별 회원 비밀번호 초기화
export async function resetUserPassword(user_id) {
    try {

        // 1. 유저 찾기
        const user = await AppDataSource3.getRepository("user").findOneBy({
            username: user_id
        });

        // 2. 임시 비밀번호 생성
        //const authNumber = Math.floor(Math.random() * 888888) + 111111;
        const authString = Array.from({ length: 8 }, () => 
        'abcdefghijklmnopqrstuvwxyz0123456789'[
            Math.floor(Math.random() * 36)
        ]
        ).join('');

        //console.log("임시비밀번호 = ", authString);
        // 3. 이메일 발송
        const smtpTransport = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER, // mail 발송 이메일 주소
                pass: process.env.SMTP_PASSWORD, // 해당 이메일 비밀번호
            },
            // tls: {
            //   rejectUnauthorized: false,
            // }
        });
    
        const mailOptions = {
            from: process.env.SMTP_USER, // 발송 주체
            to: user.email, // 인증을 요청한 이메일 주소
            subject: '[팬직] 임시 비밀번호 발급 안내',
            html: `
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9f9f9;">
            <div
                style=" max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <h1 style="text-align: center; margin-bottom: 0;">Fanzic 임시 비밀번호 발급</h1>
                <p style="font-size: 16px; color: #555; line-height: 24px; text-align: center;">
                    안녕하세요, 임시 비밀번호 발급 안내해드립니다. <br>
                    아래의 임시 비밀번호를 입력하여 로그인 후 비밀번호를 변경해주세요.
                </p>
                <div style="text-align: center; margin: 20px 0;">
                    <span
                        style="display: inline-block; font-size: 24px; color: #3e86f2; font-weight: bold; padding: 10px 20px; border: 1px solid #3e86f2; border-radius: 5px;">
                        ${authString}
                    </span>
                </div>
                <p style="font-size: 14px; color: #777; text-align: center;">본 메일을 요청하지 않으셨다면 무시하셔도 됩니다.</p>
                <hr style="border: 0; height: 1px; background-color: #e0e0e0; margin: 20px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    &copy; Copyright 2019 FANZIC Corp. All Rights Reserved.
                </p>
            </div>
            </body>
            `
        };
    
        // 연결 확인
        await smtpTransport.verify();
        console.log("SMTP 서버 연결 성공");
        
        // Promise를 반환하도록 수정
        smtpTransport.sendMail(mailOptions);
        smtpTransport.close();
        console.log("메일 보내기 성공");

        const temporaryPassword = bcrypt.hashSync(authString, 10);
        // 임시비밀번호로 비밀번호 저장
        console.log("임시비번 = ", authString);
        console.log(temporaryPassword);
        
        user.password = temporaryPassword;
        // 3. 비밀번호 저장(DB)
        
        //user.password = temporaryPassword;
        await AppDataSource3.getRepository("user").save(user);
        //const updatedUser = await userRepository.save(user); 이전것
        //console.log("User has been updated", updatedUser);

        // 4. 푸시 알림 발송
        sendPushNotification(user);
                
        return { success: true };
    } catch (error) {
        console.error("resetUserPassword error:", error);
        throw error;
    }   
}

// ========================================
// 📊 관리자 - 팬정보
// ========================================

//✅ 팬정보 - 1. 모든 팬 정보 조회
export async function fanDetailInfo({ userId, fan_type, fan_id, page = 1, limit = 10 }) {
    console.log("✅ 팬정보 - 1. 팬 정보 조회(유저별/타입별/팬별)");

    const offset = (page - 1) * limit;

    let whereCeiling = ` h.deleted_flag = 0 `;
    let whereVentil = ` h.deleted_flag = 0 `;

    if (userId) {
        whereCeiling += ` AND (u.username = '${userId}' OR u.name = '${userId}')`;
        whereVentil += ` AND (u.username = '${userId}' OR u.name = '${userId}')`;
    }

    // 팬아이디이 아님 유동일때는 ssid를 불러오고 실링일때는 name으로 불러올 예정(정해진 화면이 없어서 결정)
    if (fan_id) {
        whereCeiling += ` AND f.name = '${fan_id}'`;
        whereVentil += ` AND f.fan_ssid = '${fan_id}'`;
    //    whereCeiling += ` AND f.id = '${fan_id}'`;
    //    whereVentil += ` AND f.id = '${fan_id}'`;
    }

    //마지막에 타입이 선택되면 나머지는 안나오게
    if (fan_type === 'ceiling') {
        whereVentil = "0=1";
    } else if (fan_type === 'ventil') {
        whereCeiling = "0=1";
    }

    // 실링팬 max 쓴 이유, gate랑 조인하려니 gate갯수만큼 나와서.. 
const fanSql = `
    SELECT
        userID,
        fan_id,
        fan_ssid,
        mac_adr,
        fan_name,
        buy_date,
        motor_state,
        fan_type
    FROM (
        -- ceiling
        SELECT
            MAX(u.username) AS userID,
            f.id AS fan_id,
            MAX(gate.ssid) AS fan_ssid,
            MAX(gate.mac_adr) AS mac_adr,
            MAX(f.name) AS fan_name,
            MAX(f.created_at) AS buy_date,
            MAX(f.motor_state) AS motor_state,
            'ceiling' AS fan_type
        FROM
            Fanzic.user u
        INNER JOIN 
            Fanzic.ceiling_house h ON u.id = h.user_id
        INNER JOIN 
            Fanzic.ceiling_gate gate ON gate.house_id = h.id
        INNER JOIN 
            Fanzic.ceiling_fan f ON f.gate_id = gate.id AND f.deleted_flag = 0
        WHERE 
            ${whereCeiling}
        GROUP BY 
            f.id

        UNION ALL

        -- ventil
        SELECT
            u.username AS userID,
            f.id AS fan_id,
            f.fan_ssid AS fan_ssid,
            COALESCE(f.mac_adr, '-') AS mac_adr,
            f.name AS fan_name,
            f.created_at AS buy_date,
            f.motor_state AS motor_state,
            'ventil' AS fan_type
        FROM
            Fanzic.user u
        INNER JOIN 
            Fanzic.ventil_house h ON u.id = h.user_id
        INNER JOIN 
            Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
        INNER JOIN 
            Fanzic.ventil_fan f ON fgm.fan_id = f.id AND f.deleted_flag = 0
        WHERE 
            ${whereVentil}
    ) AS totalFans
    ORDER BY 
        buy_date DESC, fan_type
    LIMIT 
        ${offset}, ${limit};
`;



    console.log("✅ 최종 fanSql 쿼리:", fanSql);

    const posts = await db.query(fanSql).then(result => result[0]);

    const countSql = `
        SELECT COUNT(*) as total FROM (
            SELECT f.id
            FROM Fanzic.user u
            INNER JOIN Fanzic.ceiling_house h ON u.id = h.user_id
            INNER JOIN Fanzic.ceiling_gate gate ON gate.house_id = h.id
            INNER JOIN Fanzic.ceiling_fan f ON f.gate_id = gate.id AND f.deleted_flag = 0
            WHERE ${whereCeiling}
            GROUP BY f.id

            UNION ALL

            SELECT f.id
            FROM Fanzic.user u
            INNER JOIN Fanzic.ventil_house h ON u.id = h.user_id
            INNER JOIN Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            INNER JOIN Fanzic.ventil_fan f ON fgm.fan_id = f.id AND f.deleted_flag = 0
            WHERE ${whereVentil}
        ) AS totalData
    `;

    //console.log("✅ 최종 countSql 쿼리:", countSql);

    const totalResult = await db.query(countSql).then(result => result[0]);
    const total = totalResult[0]?.total || 0;

    const numberedPosts = posts.map((post, index) => ({
        no: offset + index + 1,
        ...post,
    }));

    const totalPages = Math.ceil(total / limit);
    const pageUnit = 5;
    const startPage = Math.floor((page - 1) / pageUnit) * pageUnit + 1;
    const endPage = Math.min(startPage + pageUnit - 1, totalPages);

    return {
        posts: numberedPosts,
        page,
        limit,
        total,
        totalPages,
        startPage,
        endPage,
    };
}

// ✅ 팬정보 - 2. 팬 사용시간 조회
export async function usedTime(fan_id, fan_type, start_month) {
    console.log("✅ 팬정보 - 2. 팬 사용시간 조회");

    // fan_type 에 따른 테이블 결정
    let logTable;
    if (fan_type === 'ceiling') {
        logTable = 'ceiling_fan_control_log';
    } else if (fan_type === 'ventil') {
        logTable = 'ventil_fan_control_log';
    } else {
        throw new Error("유효하지 않은 fan_type");
    }

    // 월 기준 조회 기간 계산
    const date = start_month;
    const pastDate = subMonths(date, 0);
    const startOfTheMonth = startOfMonth(pastDate);
    const nextStartOfTheMonth = addDays(startOfTheMonth, 1);
    const RealStartOfTheMonth = nextStartOfTheMonth.toISOString().split('T')[0];
    const end = endOfMonth(pastDate);
    const endOfTheMonth = end.toISOString().split('T')[0];

    // ✅ 쿼리
    const usedTimeSql = 
        "SELECT " +
        "fan_id, " +
        "time_stamp AS start_time, " +
        "(SELECT time_stamp " +
        " FROM " + logTable + " AS nextLog " +
        " WHERE nextLog.fan_id = currentLog.fan_id " +
        " AND nextLog.id > currentLog.id " +
        " AND nextLog.command = 'fan-off' " +
        " ORDER BY nextLog.id ASC " +
        " LIMIT 1) AS end_time " +
        "FROM " + logTable + " AS currentLog " +
        "WHERE command = 'fan-on' " +
        "AND fan_id = ? " +
        "AND time_stamp BETWEEN ? AND ? " +
        "ORDER BY time_stamp DESC";

    console.log("🚀 실행 쿼리:", usedTimeSql);
    console.log("🚀 파라미터:", [fan_id, RealStartOfTheMonth, endOfTheMonth]);

    // ✅ Fanzic DB에서 직접 조회
    const usedTimeResult = await AppDataSource3.query(
        usedTimeSql, 
        [fan_id, RealStartOfTheMonth, endOfTheMonth]
    );

    // ✅ 날짜 포맷
    const formattedResult = usedTimeResult.map(row => ({
        ...row,
        start_time: formatDate(row.start_time),
        end_time: row.end_time ? formatDate(row.end_time) : null,
    }));

    console.log("✅ 조회 결과:", formattedResult);
    return formattedResult;
}

// ✅ 팬정보 - 7. 팬  사용시간 이력 
export async function totalUsedTime(fan_type, fan_id) {
    console.log("✅ 팬정보 - 7. 팬  사용시간 이력 ");

    let fanControlLogs = [];

    if (fan_type === "ventil") {
        fanControlLogs = await VentilFanControlLogRepository.find({
            where: { fan_id: fan_id },
            order: { time_stamp: "ASC" }
        });
    } else if (fan_type === "ceiling") {
        fanControlLogs = await CeilingFanControlLogRepository.find({
            where: { fan_id: fan_id },
            order: { time_stamp: "ASC" }
        });
    } else {
        throw new Error("fan_type은 'ventil' 또는 'ceiling' 이어야 합니다.");
    }

    let totalRuntime = 0;
    let lastOnTime = null;

    //로그 순회하며 작동시간 계산
    fanControlLogs.forEach((log) => {
        if (log.command === "fan-on") {
            lastOnTime = log.time_stamp; //팬이 켜지면 lastOnTime 에 시간 저장.
        } else if (log.command === "fan-off" && lastOnTime) {
            const offTime = log.time_stamp;//팬이 꺼질 때 fan-off 시간 - fan-on 시간 으로 작동시간 계산.
            totalRuntime += (new Date(offTime).getTime() - new Date(lastOnTime).getTime()) / 1000; //초단위저장
            lastOnTime = null;
        }
    });

    const hours = Math.floor(totalRuntime / 3600);  //시
    const minutes = Math.floor((totalRuntime % 3600) / 60); //뷴
    const seconds = Math.floor(totalRuntime % 60);  //초 단위 변환

    const totalUsedTime = `${hours}시간 ${minutes}분 ${seconds}초`;

    return {
        fan_id,
        fan_type,
        totalUsedTime,
        totalSeconds: totalRuntime
    };
}

// ✅ 팬정보 - 3. 팬 이벤트 로그 조회 (ceiling / ventil 구분)
export async function eventLog(fan_id, fan_type, start_month) {
    console.log("✅ 팬정보 - 3. 팬 이벤트 로그 조회");

    // fan_type 에 따라 테이블 결정
    let logTable;
    if (fan_type === 'ceiling') {
        logTable = 'ceiling_fan_control_log';
    } else if (fan_type === 'ventil') {
        logTable = 'ventil_fan_control_log';
    } else {
        throw new Error("유효하지 않은 fan_type: ceiling 또는 ventil만 허용");
    }

    // 월 기준 기간 계산
    const date = start_month;
    const pastDate = subMonths(date, 0);
    const startOfTheMonth = startOfMonth(pastDate);
    const nextStartOfTheMonth = addDays(startOfTheMonth, 1);
    const RealStartOfTheMonth = nextStartOfTheMonth.toISOString().split('T')[0];
    const end = endOfMonth(pastDate);
    const endOfTheMonth = end.toISOString().split('T')[0];

    const eventLogSql = 
        `SELECT 
            fan_id AS id,
            time_stamp AS eventTime,
            command AS eventLog
        FROM ${logTable} AS currentLog
        WHERE 
            fan_id = ?
            AND time_stamp BETWEEN ? AND ?
        ORDER BY eventTime ASC;`;

    console.log("실행 쿼리:", eventLogSql);
    console.log("파라미터:", [fan_id, RealStartOfTheMonth, endOfTheMonth]);

    const eventLogResult = await AppDataSource3.query(eventLogSql, [fan_id, RealStartOfTheMonth, endOfTheMonth]);

    // 날짜 포맷
    const formattedResult = eventLogResult.map(row => ({
        ...row,
        eventTime: formatDate(row.eventTime)
    }));

    console.log("조회 결과:", formattedResult);
    return formattedResult;
}
/*
// 팬 내용 수정
export async function modifyFan(fan_id, info) {
    try {
        const fan = await fanRepository.findOneBy({ id: fan_id, deletedFlag: 0});
        if (fan) {

            const updatedFan = await fanRepository.save(fan);
            console.log("Fan has been updated", updatedFan);
            return "success";
          } else {
            console.log("Fan not found");
            return "Fan not found"
          }        
    } catch (error) {
        console.log(error);
    }   
}
*/
//  ✅ 팬정보 - 4. 팬 삭제
export async function deleteFan(fan_type, fan_id) {
    console.log("✅ 팬정보 - 4. 팬 삭제 fan_type:", fan_type, "fan_id:", fan_id);

    let fanTable, mappingTable;
    if (fan_type === 'ceiling') {
        fanTable = 'ceiling_fan';
        mappingTable = 'ceiling_fan_group_mapping';
    } else if (fan_type === 'ventil') {
        fanTable = 'ventil_fan';
        mappingTable = 'ventil_fan_group_mapping';
    } else {
        throw new Error("유효하지 않은 fan_type");
    }

    const updateFanSql = `UPDATE ${fanTable} SET deleted_flag = 1, deleted_at = NOW() WHERE id = ?`;
    const updateMapSql = `UPDATE ${mappingTable} SET fan_deleted = 1 WHERE fan_id = ?`;

    console.log("🚀 fan 테이블 삭제 SQL:", updateFanSql);
    console.log("🚀 mapping 테이블 삭제 SQL:", updateMapSql);

    await AppDataSource3.query(updateFanSql, [fan_id]);
    await AppDataSource3.query(updateMapSql, [fan_id]);

    return { fan_id, fan_type, status: "deleted" };
}

// ✅ 팬정보 - 5. 팬 수정모달창 조회
export async function fanDetailModal(info) {
    try {
        console.log("✅ 팬정보 - 5. 팬 수정모달창 조회 info:", info);

        let fanSql;
        if (info.fan_type === 'ceiling') {
            fanSql = `
                SELECT 
                    f.id AS fan_id,
                    f.name AS fan_name,
                    gate.ip_adr AS ip_address,
                    gate.mac_adr AS mac_address,
                    gate.wifi_name AS wifi_name,
                    gate.ssid AS ssid,
                    u.username AS user_name,
                    f.created_at AS created_at
                FROM 
                    Fanzic.ceiling_fan f
                LEFT JOIN 
                    Fanzic.ceiling_gate gate ON f.gate_id = gate.id
                LEFT JOIN 
                    Fanzic.ceiling_house h ON gate.house_id = h.id
                LEFT JOIN 
                    Fanzic.user u ON h.user_id = u.id
                WHERE 
                    f.id = ?
                    AND f.deleted_flag = 0;
            `;
        } else if (info.fan_type === 'ventil') {
            fanSql = `
                SELECT 
                    f.id AS fan_id,
                    f.name AS fan_name,
                    f.ip_adr AS ip_address,
                    f.mac_adr AS mac_address,
                    f.wifi_adr AS wifi_name,
                    f.fan_ssid AS ssid,
                    u.username AS user_name,
                    f.created_at AS created_at
                FROM 
                    Fanzic. ventil_fan f
                LEFT JOIN 
                    Fanzic.ventil_fan_group_mapping fgm ON f.id = fgm.fan_id
                LEFT JOIN 
                    Fanzic.ventil_house h ON fgm.house_id = h.id
                LEFT JOIN 
                    Fanzic.user u ON h.user_id = u.id
                WHERE 
                    f.id = ?
                    AND f.deleted_flag = 0;
            `;
        } else {
            throw new Error("유효하지 않은 fan_type (ceiling 또는 ventil)");
        }

        const fanResult = await AppDataSource3.query(fanSql, [info.fan_id])
        .then((result) => result[0]);
        
        return fanResult;
    } catch (error) {
        console.log(error);
    }   
}

// ✅ 팬정보 -  6. 팬 수정모달창 수정
export async function modifyFanDetail(fanType, fanId, info) {
    try {
        console.log("✅ 팬정보 - 6. 팬 수정모달창 수정");
        //console.log("fanType =", fanType, "fanId =", fanId);
        //console.log("info =", info);

        if (fanType === 'ventil') {
            // ============= ventil_fan ==================
            let fields = [];
            let params = [];

            if (info.name !== undefined) {
                fields.push("name = ?");
                params.push(info.name);
            }
            if (info.ip_adr !== undefined) {
                fields.push("ip_adr = ?");
                params.push(info.ip_adr);
            }
            if (info.mac_adr !== undefined) {
                fields.push("mac_adr = ?");
                params.push(info.mac_adr);
            }
            if (info.wifi_adr !== undefined) {
                fields.push("wifi_adr = ?");
                params.push(info.wifi_adr);
            }
            if (info.fan_ssid !== undefined) {
                fields.push("fan_ssid = ?");
                params.push(info.fan_ssid);
            }
            if (info.created_at !== undefined) {
                const buyDate = `${new Date(info.created_at).toISOString().split('T')[0]} 00:00:00`;
                fields.push("created_at = ?");
                params.push(buyDate);
            }

            if (fields.length === 0) {
                console.log("🚫 ventil 변경할 필드 없음: UPDATE 실행하지 않음");
                return "nothing changed";
            }

            fields.push("updated_at = NOW()");
            const sql = `
                UPDATE ventil_fan
                SET ${fields.join(", ")}
                WHERE id = ? AND deleted_flag = 0
            `;
            params.push(fanId);

            await AppDataSource3.query(sql, params);
            console.log("✅ ventil_fan updated:", sql, params);

            return "success";

        } else if (fanType === 'ceiling') {
            // ============= ceiling_fan ==================
            let fanFields = [];
            let fanParams = [];

            if (info.name !== undefined) {
                fanFields.push("name = ?");
                fanParams.push(info.name);
            }
            if (info.created_at !== undefined) {
                const buyDate = `${new Date(info.created_at).toISOString().split('T')[0]} 00:00:00`;
                fanFields.push("created_at = ?");
                fanParams.push(buyDate);
            }

            if (fanFields.length > 0) {
                fanFields.push("updated_at = NOW()");
                await AppDataSource3.query(`
                    UPDATE ceiling_fan
                    SET ${fanFields.join(", ")}
                    WHERE id = ? AND deleted_flag = 0
                `, [...fanParams, fanId]);
                console.log("✅ ceiling_fan updated");
            } else {
                console.log("🚫 ceiling_fan 변경할 필드 없음");
            }

            // ============= ceiling_gate ==================
            let gateFields = [];
            let gateParams = [];

            if (info.ip_adr !== undefined) {
                gateFields.push("ip_adr = ?");
                gateParams.push(info.ip_adr);
            }
            if (info.mac_adr !== undefined) {
                gateFields.push("mac_adr = ?");
                gateParams.push(info.mac_adr);
            }
            if (info.wifi_adr !== undefined) {
                gateFields.push("wifi_name = ?");
                gateParams.push(info.wifi_adr);
            }
            if (info.fan_ssid !== undefined) {
                gateFields.push("ssid = ?");
                gateParams.push(info.fan_ssid);
            }
            if (info.created_at !== undefined) {
                const buyDate = `${new Date(info.created_at).toISOString().split('T')[0]} 00:00:00`;
                gateFields.push("created_at = ?");
                gateParams.push(buyDate);
            }

            if (gateFields.length > 0) {
                gateFields.push("updated_at = NOW()");
                await AppDataSource3.query(`
                    UPDATE ceiling_gate
                    SET ${gateFields.join(", ")}
                    WHERE id = (SELECT gate_id FROM ceiling_fan WHERE id = ?)
                `, [...gateParams, fanId]);
                console.log("✅ ceiling_gate updated");
            } else {
                console.log("🚫 ceiling_gate 변경할 필드 없음");
            }

            if (fanFields.length === 0 && gateFields.length === 0) {
                return "nothing changed";
            }

            return "success";

        } else {
            console.log("❌ Invalid fanType:", fanType);
            return "Invalid fan_type (ventil or ceiling)";
        }

    } catch (error) {
        console.log("❌ modifyFanDetail query error:", error);
        throw error;
    }
}

// 날짜 변환 함수 
function formatDate(date) {
    if (!date) return null; // Handle null values gracefully
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const dd = String(d.getDate()).padStart(2, '0');
    const HH = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
}

// 날짜 변환 함수 
function formatDay(date) {
    if (!date) return null; // Handle null values gracefully
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const dd = String(d.getDate()).padStart(2, '0');
    // const HH = String(d.getHours()).padStart(2, '0');
    // const mm = String(d.getMinutes()).padStart(2, '0');
    // const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${MM}-${dd}`;
}
/*
// 팬상태로그 삭제
export async function deleteFanStatus() {
    try {
        const deleteFanStatus = await FanStatusRepository.delete({conn_status: 'online'});
        return "success"
    } catch (error) {
        console.log(error);
        return "failed";
    }   
}
*/
// ========================================
// 📊 관리자 - 통계 페이지 - 유동팬
// ========================================

// ✅ 1. 유동팬 유저별 일간 에너지통계 조회
export async function dayEnergyInfo(info) {
    
    console.log(" ✅ 1. 유저별 일간 에너지통계 조회");
    const today = info.start_date;
    const dataList = [];
    
    // 1) 사용자 정보 조회 
    // 사용자 ID로 사용자 찾기 (userID 또는 name으로 검색)
    const user_id = await userRepository3.findOne({ where: [{ username: info.userId }, { name: info.userId }] });

    if( !user_id ){
        //console.log("없는 사용자 입니다.");
        return { message : "없는 사용자 입니다."};
    }
    // 사용자 기본 정보 + 팬 개수 조회
    const usersSql = 
            `SELECT 
                u.id AS user_id,
                u.username,
                u.name,
                u.standard_rate,
                COUNT(CASE WHEN fgm.fan_deleted = 0 THEN fgm.fan_id END) AS fanCount	-- 하우스랑 매핑 안된건 안찾겠다는건가 
            FROM 
                Fanzic.user u
            LEFT JOIN 
                Fanzic.ventil_house h ON u.id = h.user_id AND h.deleted_flag = 0
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            WHERE
                u.id = ?
            GROUP BY 
                u.id;`;
    const usersResultArr = await AppDataSource3.query(usersSql, [user_id.id]);
    const usersResult = usersResultArr[0];

    // 2) 작업장 정보 조회 
    // 사용자의 모든 작업장 조회
    const houseSql = 
            `SELECT 
                h.id AS house_id,
                h.name AS house_name,
                h.order AS house_order_num,
                COUNT(DISTINCT f.id) AS fan_count
            FROM 
                Fanzic.ventil_house h
            LEFT JOIN 
                Fanzic.ventil_group fg ON h.id = fg.house_id
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            LEFT JOIN
                Fanzic.ventil_fan f ON f.id = fgm.fan_id AND f.deleted_flag = 0
            WHERE 
                h.user_id = ?
                AND h.deleted_flag = 0
            GROUP BY 
                h.id, h.name, h.order
            ORDER BY 
                h.order ASC;
            `;

    const houseResult = await AppDataSource3.query(houseSql, [user_id.id]);

    const houseList = houseResult.map(house => ({
        id: house.house_id,
        name: house.house_name,
        houseOrderNum: house.house_order_num,
        getFanNum: house.fan_count
        })
    );

    // 3) 에너지 통계 조회  //💡 14일간의 일별 에너지 계산
    let totalWattage = 0;
    for (let i = 0; i < 14; i++) {
        // i일 전 날짜 계산
        const dateObj = subDays(today, i);
        const startdate = `${dateObj.toISOString().split('T')[0]} 00:00:00`;
        const end_date = `${dateObj.toISOString().split('T')[0]} 23:59:59`;
        // 4) 하루의 모든팬 별 총 구동시간 조회 ( 팬 On-Off 쌍 조회 후 총 구동시간 계산 )
        const energyInfoSql = 
            `WITH FanOnOffPairs AS (
                SELECT 
                    fcl_on.fan_id,
                    fcl_on.time_stamp AS fan_on_time,
                    MIN(fcl_off.time_stamp) AS fan_off_time
                FROM 
                    ventil_fan_control_log fcl_on
                LEFT JOIN 
                    ventil_fan_control_log fcl_off
                ON 
                    fcl_on.fan_id = fcl_off.fan_id
                    AND fcl_off.command = 'fan-off'
                    AND fcl_off.time_stamp > fcl_on.time_stamp
                WHERE 
                    fcl_on.command = 'fan-on'
                    AND fcl_on.time_stamp BETWEEN ? AND ?
                GROUP BY 
                    fcl_on.fan_id, fcl_on.time_stamp
            ),
            Durations AS (
                SELECT 
                    fan_id,
                    TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
                FROM 
                    FanOnOffPairs
                WHERE 
                    fan_off_time IS NOT NULL 
            )
            SELECT 
                h.user_id,
                fgm.fan_id,
                SUM(d.duration_seconds) AS total_runtime_seconds
            FROM 
                Durations d
            JOIN 
                ventil_fan_group_mapping fgm ON d.fan_id = fgm.fan_id
            JOIN 
                ventil_house h ON fgm.house_id = h.id
            WHERE 
                h.user_id = ?
            GROUP BY 
                h.user_id, fgm.fan_id;
            `;
            const energyResult = await AppDataSource3.query(energyInfoSql, [startdate, end_date, user_id.id]);
            //console.log("energyResult = ", energyResult);
            // 5) 에너지 사용량 계산 
            let totalruntime = 0 // 하루의 모든팬의 총구동시간 계산 
            for (const data of energyResult) {
                let runtime = Number(data.total_runtime_seconds);
                
                if ( runtime == null) {
                    runtime = 0
                }
                totalruntime += runtime;
            }

            console.log("하루의 모든팬의 총구동시간 = ", totalruntime);

            // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
            const wattage = (totalruntime / 3600) * 0.064;
            const kwh = parseFloat(wattage.toFixed(5))
            totalWattage += kwh;
            // 사용시간 (시간 단위)
            const usedTime = Math.floor(totalruntime/ 3600);

            // 데이터 리스트에 추가
            dataList.push({
                startDate: startdate,
                energyUsage: kwh,
                usedTime: usedTime,
            });
        }

        // 6) 최종 요금계산  에너지 사용량 계산 
        // 요금 계산
        const totalCharge = totalWattage * usersResult.standard_rate
        // 평균 소비량 계산
        const averageWattage = parseFloat((totalWattage / 14).toFixed(5));
        // 평균 요금 계산   
        const averageCharge = parseFloat((totalCharge / 14).toFixed(5));

        // 최종 리턴 데이터     // 14일간의 일별 에너지 계산 결과 리턴 
        const returnList = {
            id : user_id.id,
            userId: usersResult.username,
            houseList: houseList,
            fanCount : usersResult.fanCount,
            standard_rate: usersResult.standard_rate,
            totalWattage: totalWattage,
            averageWattage: averageWattage,
            charges: new Intl.NumberFormat('en-US').format(totalCharge),
            averageCharge: new Intl.NumberFormat('en-US').format(averageCharge),
            dataList: dataList               
        }

        console.log("returnList = ", returnList)
        return returnList;
}
// ✅ 2. 유동팬 유저별 주간 에너지통계 조회 / 최근 14주간 주별
export async function weekEnergyInfo(info) {
    
    console.log(" ✅ 2. 유저별 주간 에너지통계 조회");
    const date = info.start_week;
    const dataList = [];

    // 1) 사용자 정보 조회 
    // 사용자 ID로 사용자 찾기 (userID 또는 name으로 검색)
    const user_id = await userRepository3.findOne({ where: [{ username: info.userId }, { name: info.userId }] });

    if( !user_id ){
        //console.log("없는 사용자 입니다.");
        return { message : "없는 사용자 입니다."};
    }
    // 사용자 기본 정보 + 팬 개수 조회
    const usersSql = 
            `SELECT 
                u.id AS user_id,
                u.username,
                u.name,
                u.standard_rate,
                COUNT(CASE WHEN fgm.fan_deleted = 0 THEN fgm.fan_id END) AS fanCount	-- 하우스랑 매핑 안된건 안찾겠다는건가 
            FROM 
                Fanzic.user u
            LEFT JOIN 
                Fanzic.ventil_house h ON u.id = h.user_id AND h.deleted_flag = 0
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            WHERE
                u.id = ?
            GROUP BY 
                u.id;`;
    const usersResultArr = await AppDataSource3.query(usersSql, [user_id.id]);
    const usersResult = usersResultArr[0];


    // 2) 작업장 정보 조회 
    // 사용자의 모든 작업장 조회
    const houseSql = 
            `SELECT 
                h.id AS house_id,
                h.name AS house_name,
                h.order AS house_order_num,
                COUNT(DISTINCT f.id) AS fan_count
            FROM 
                Fanzic.ventil_house h
            LEFT JOIN 
                Fanzic.ventil_group fg ON h.id = fg.house_id
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            LEFT JOIN
                Fanzic.ventil_fan f ON f.id = fgm.fan_id AND f.deleted_flag = 0
            WHERE 
                h.user_id = ?
                AND h.deleted_flag = 0
            GROUP BY 
                h.id, h.name, h.order
            ORDER BY 
                h.order ASC;
            `;

    const houseResult = await AppDataSource3.query(houseSql, [user_id.id]);

    const houseList = houseResult.map(house => ({
        id: house.house_id,
        name: house.house_name,
        houseOrderNum: house.house_order_num,
        getFanNum: house.fan_count
        })
    );

    // 3) 에너지 통계 조회  //💡 14주간의 주별 에너지 계산
    let totalWattage = 0;
    for (let i = 0; i < 14; i++) {
        const pastDate = subWeeks(new Date(date), i);  // i주 전 날짜 계산
        console.log("과거 일 = ", pastDate);

        // 해당 주의 시작과 종료 날짜 계산
        const startOfTheWeek = startOfWeek(pastDate, { weekStartsOn: 1 }); // 해당 주의 월요일 시작
        const endOfTheWeek = endOfWeek(pastDate, { weekStartsOn: 1 });
        // UTC 시간으로 변환
        const startOfTheWeekUTC = new Date(startOfTheWeek.getTime() - startOfTheWeek.getTimezoneOffset() * 60 * 1000);
        const endOfTheWeekUTC = new Date(endOfTheWeek.getTime() - endOfTheWeek.getTimezoneOffset() * 60 * 1000);

        console.log(`Week Query Range: ${startOfTheWeekUTC.toISOString()} - ${endOfTheWeekUTC.toISOString()}`);
        // 4) 해당 주의 팬 구동 시간 및 에너지 사용량 계산 ( 1번 쿼리 반복됨 )
        const energyInfoSql = 
           `WITH FanOnOffPairs AS (
                SELECT 
                    fcl_on.fan_id,
                    fcl_on.time_stamp AS fan_on_time,
                    MIN(fcl_off.time_stamp) AS fan_off_time
                FROM 
                    ventil_fan_control_log fcl_on
                LEFT JOIN 
                    ventil_fan_control_log fcl_off
                ON 
                    fcl_on.fan_id = fcl_off.fan_id
                    AND fcl_off.command = 'fan-off'
                    AND fcl_off.time_stamp > fcl_on.time_stamp
                WHERE 
                    fcl_on.command = 'fan-on'
                    AND fcl_on.time_stamp BETWEEN ? AND ?
                GROUP BY 
                    fcl_on.fan_id, fcl_on.time_stamp
            ),
            Durations AS (
                SELECT 
                    fan_id,
                    TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
                FROM 
                    FanOnOffPairs
                WHERE 
                    fan_off_time IS NOT NULL 
            )
            SELECT 
                h.user_id,
                fgm.fan_id,
                SUM(d.duration_seconds) AS total_runtime_seconds
            FROM 
                Durations d
            JOIN 
                ventil_fan_group_mapping fgm ON d.fan_id = fgm.fan_id
            JOIN 
                ventil_house h ON fgm.house_id = h.id
            WHERE 
                h.user_id = ?
            GROUP BY 
                h.user_id, fgm.fan_id;
            `;
        
        const energyResult = await AppDataSource3.query(energyInfoSql, [startOfTheWeekUTC, endOfTheWeekUTC, user_id.id]);  
        //console.log("energyResult = ", energyResult);

        // 5) 에너지 사용량 계산 
        let totalruntime = 0 // 해당 주의 모든팬의 총구동시간 계산 
        let runtime = 0 // 해당 주의 팬 별 구동시간 계산 
        for (const data of energyResult) {
            runtime = Number(data.total_runtime_seconds);
            if ( runtime == null) {
                runtime = 0
            }
            totalruntime += runtime;
        }

        console.log("그 주의 모든팬의 총구동시간 = ", totalruntime);

        // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
        const wattage = (totalruntime / 3600) * 0.064;
        const kwh = parseFloat(wattage.toFixed(5));
        totalWattage += kwh; // 총 에너지 사용량 계산 

        // 사용시간 (시간 단위)
        const usedTime = Math.floor(totalruntime/ 3600);

        // 데이터 리스트에 추가
        dataList.push({
            startDate: startOfTheWeekUTC.toISOString().split('T')[0],   // 해당 주의 주간 시작 날짜(월요일)  
            energyUsage: kwh,                                           // 해당 주의 주간 에너지 사용량(kWh)
            usedTime: usedTime                                          // 해당 주의 주간 총 구동시간(시간)            
        });
    }

    // 6) 최종 요금계산  에너지 사용량 계산 
    // 요금 계산
    const totalCharge = totalWattage * usersResult.standard_rate
    // 평균 소비량 계산 (14주 평균)
    const averageWattage = parseFloat((totalWattage / 14).toFixed(5));
    // 평균 요금 계산 (14주 평균)   
    const averageCharge = parseFloat((totalCharge / 14).toFixed(5));

    // 최종 리턴 데이터     // 14일간의 일별 에너지 계산 결과 리턴 
    const returnList = {
        id : user_id.id,
        userId: usersResult.username,
        houseList: houseList,
        fanCount : usersResult.fanCount,
        standard_rate: usersResult.standard_rate,
        totalWattage: totalWattage,                             // 14주 총 전력 사용량          
        averageWattage: averageWattage,                         // 14주 평균 전력 사용량
        charges: new Intl.NumberFormat('en-US').format(totalCharge), // 14주 총 요금
        averageCharge: new Intl.NumberFormat('en-US').format(averageCharge), // 14주 평균 요금
        dataList: dataList        // 14주 주별 에너지 사용량 리스트     
    }

    console.log("returnList = ", returnList)
    return returnList;
}

// ✅ 3. 유동팬 유저별 월간 에너지통계 조회 
export async function monthEnergyInfo(info) {
    
    console.log(" ✅ 3. 유저별 월간 에너지통계 조회");
    const date = info.start_month;
    const dataList = [];    

    // 1) 사용자 정보 조회 (다른 함수들과 동일)
    // 사용자 ID로 사용자 찾기 (userID 또는 name으로 검색)
    const user_id = await userRepository3.findOne({ where: [{ username: info.userId }, { name: info.userId }] });

    if( !user_id ){
        //console.log("없는 사용자 입니다.");
        return { message : "없는 사용자 입니다."};
    }
    // 사용자 기본 정보 + 팬 개수 조회   
    const usersSql = 
            `SELECT 
                u.id AS user_id,
                u.username,
                u.name,
                u.standard_rate,
                COUNT(CASE WHEN fgm.fan_deleted = 0 THEN fgm.fan_id END) AS fanCount	-- 하우스랑 매핑 안된건 안찾겠다는건가 
            FROM 
                Fanzic.user u
            LEFT JOIN 
                Fanzic.ventil_house h ON u.id = h.user_id AND h.deleted_flag = 0
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            WHERE
                u.id = ?
            GROUP BY 
                u.id;`;
    
    // Get userId
    const usersResult = await db.execute(usersSql, [user_id.id]).then((result) => result[0][0]);

    // 2) 작업장 정보 조회 (다른 함수들과 동일)
    // 사용자의 모든 작업장 조회
    const houseSql = 
            `SELECT 
                h.id AS house_id,
                h.name AS house_name,
                h.order AS house_order_num,
                COUNT(DISTINCT f.id) AS fan_count
            FROM 
                Fanzic.ventil_house h
            LEFT JOIN 
                Fanzic.ventil_group fg ON h.id = fg.house_id
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            LEFT JOIN
                Fanzic.ventil_fan f ON f.id = fgm.fan_id AND f.deleted_flag = 0
            WHERE 
                h.user_id = ?
                AND h.deleted_flag = 0
            GROUP BY 
                h.id, h.name, h.order
            ORDER BY 
                h.order ASC;
            `;
    const houseResult = await db.execute(houseSql, [user_id.id]).then((result) => result[0]);
    const houseList = houseResult.map(house => ({
        id: house.house_id,
        name: house.house_name,
        houseOrderNum: house.house_order_num,
        getFanNum: house.fan_count
        })
    );

    // 3) 에너지 통계 조회  // 💡  12개월간의 월별 에너지 계산
    let totalWattage = 0; // 총 에너지 사용량 계산 
    for (let i = 0; i < 12; i++) {
        const pastDate = subMonths(date, i);  // i개월 전 날짜 계산
        // 해당 월의 시작과 종료 날짜 계산
        const startOfTheMonth = startOfMonth(pastDate); // 해당 월의 첫째 날
        const nextStartOfTheMonth = addDays(startOfTheMonth, 1); // 해당 월의 다음 달 1일
        const RealStartOfTheMonth = nextStartOfTheMonth.toISOString().split('T')[0]; // 해당 월의 1일

        // 해당 월의 마지막 날짜 계산
        const end = endOfMonth(pastDate); // 해당 월의 마지막 날
        const endOfTheMonth = end.toISOString().split('T')[0]; // 해당 월의 마지막 날짜

        // 4) 해당 월의 팬 구동 시간 및 에너지 사용량 계산 ( 1번 쿼리 반복됨 )
        const energyInfoSql = 
        `WITH FanOnOffPairs AS (
                SELECT 
                    fcl_on.fan_id,
                    fcl_on.time_stamp AS fan_on_time,
                    MIN(fcl_off.time_stamp) AS fan_off_time
                FROM 
                    ventil_fan_control_log fcl_on
                LEFT JOIN 
                    ventil_fan_control_log fcl_off
                ON 
                    fcl_on.fan_id = fcl_off.fan_id
                    AND fcl_off.command = 'fan-off'
                    AND fcl_off.time_stamp > fcl_on.time_stamp
                WHERE 
                    fcl_on.command = 'fan-on'
                    AND fcl_on.time_stamp BETWEEN ? AND ?
                GROUP BY 
                    fcl_on.fan_id, fcl_on.time_stamp
            ),
            Durations AS (
                SELECT 
                    fan_id,
                    TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
                FROM 
                    FanOnOffPairs
                WHERE 
                    fan_off_time IS NOT NULL 
            )
            SELECT 
                h.user_id,
                fgm.fan_id,
                SUM(d.duration_seconds) AS total_runtime_seconds
            FROM 
                Durations d
            JOIN 
                ventil_fan_group_mapping fgm ON d.fan_id = fgm.fan_id
            JOIN 
                ventil_house h ON fgm.house_id = h.id
            WHERE 
                h.user_id = ?
            GROUP BY 
                h.user_id, fgm.fan_id;
            `;
    
        const energyResult = await AppDataSource3.query(energyInfoSql, [RealStartOfTheMonth, endOfTheMonth, user_id.id]);
       
        // 5) 에너지 사용량 계산 
        let totalruntime = 0 // 해당 월의 모든팬의 총구동시간 계산 
        let runtime = 0 // 해당 월의 팬 별 구동시간 계산 
        for (const data of energyResult) {
            runtime = Number(data.total_runtime_seconds);
            
            if ( runtime == null) {
                runtime = 0
            }
            totalruntime += runtime;
        }
       
        // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
        const wattage = (totalruntime / 3600) * 0.064;
        const kwh = parseFloat(wattage.toFixed(5));
        totalWattage += kwh; // 총 에너지 사용량 계산 

        // 사용시간 (시간 단위)
        const usedTime = Math.floor(totalruntime / 3600);

        // 데이터 리스트에 추가
        dataList.push({
            startDate: RealStartOfTheMonth,
            usedTime: usedTime,
            energyUsage: kwh
        });
    }

    // 6) 최종 요금계산  에너지 사용량 계산 
    // 요금 계산
    const totalCharge = totalWattage * usersResult.standard_rate
    // 평균 소비량 계산 (12개월 평균)
    const averageWattage = parseFloat((totalWattage / 12).toFixed(5));
    // 평균 요금 계산 (12개월 평균)   
    const averageCharge = parseFloat((totalCharge / 12).toFixed(5));

    // 최종 리턴 데이터     // 12개월 월별 에너지 계산 결과 리턴 
    const returnList = {
        id : user_id.id,
        userId: usersResult.username,
        houseList: houseList,
        fanCount : usersResult.fanCount,
        standard_rate: usersResult.standard_rate,
        totalWattage: totalWattage,
        averageWattage: averageWattage,
        charges: new Intl.NumberFormat('en-US').format(totalCharge),
        averageCharge: new Intl.NumberFormat('en-US').format(averageCharge),
        dataList: dataList
    }

    return returnList;
}

// ✅ 4. 유동팬 전체 일간 에너지통계 조회      // 최근 14일간의 일별 에너지 계산 
export async function totalDayEnergyInfo(info) {
    console.log(" ✅ 4. 전체 일간 에너지통계 조회");
    
    // 1) 날짜 정보 조회 
    const today = info.start_date;
    const dataList = [];
    
    // 2) 사용자 정보 조회 
    const usersSql =
        `SELECT 
            COUNT(DISTINCT u.id) AS total_users,
            COUNT(DISTINCT f.id) AS total_fans,
            AVG(u.standard_rate) AS avg_standard_rate
        FROM 
            Fanzic.user u
        LEFT JOIN 
            Fanzic.ventil_house h ON h.user_id = u.id AND h.deleted_flag = 0
        LEFT JOIN 
            Fanzic.ventil_fan_group_mapping fgm ON fgm.house_id = h.id
        LEFT JOIN 
            Fanzic.ventil_fan f ON f.id = fgm.fan_id AND f.deleted_flag = 0
        WHERE 
            u.id IS NOT NULL;
        `;
    const usersResultArr = await AppDataSource3.query(usersSql);
    const usersResult = usersResultArr[0];

    // 3) 에너지 통계 조회  //💡 14일간의 일별 에너지 계산
    let totalWattage = 0;
    for (let i = 0; i < 14; i++) {
        const dateObj = subDays(new Date(today), i);
        const startdate = `${dateObj.toISOString().split('T')[0]} 00:00:00`;
        const end_date = `${dateObj.toISOString().split('T')[0]} 23:59:59`;

        console.log(`Day Query Range: ${startdate} - ${end_date}`);        
        // 4) 하루의 모든팬 별 총 구동시간 조회 ( 팬 On-Off 쌍 조회 후 총 구동시간 계산 ) 💡 (이전과 다르게 where조건 없음.)
        const energyInfoSql = 
            `WITH FanOnOffPairs AS (
                SELECT 
                    fcl_on.fan_id,
                    fcl_on.time_stamp AS fan_on_time,
                    MIN(fcl_off.time_stamp) AS fan_off_time
                FROM 
                    ventil_fan_control_log fcl_on
                LEFT JOIN 
                    ventil_fan_control_log fcl_off
                ON 
                    fcl_on.fan_id = fcl_off.fan_id
                    AND fcl_off.command = 'fan-off'
                    AND fcl_off.time_stamp > fcl_on.time_stamp
                WHERE 
                    fcl_on.command = 'fan-on'
                    AND fcl_on.time_stamp BETWEEN ? AND ?
                GROUP BY 
                    fcl_on.fan_id, fcl_on.time_stamp
            ),
            Durations AS (
                SELECT 
                    fan_id,
                    TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
                FROM 
                    FanOnOffPairs
                WHERE 
                    fan_off_time IS NOT NULL 
            )
            SELECT 
                h.user_id,
                fgm.fan_id,
                SUM(d.duration_seconds) AS total_runtime_seconds
            FROM 
                Durations d
            JOIN 
                ventil_fan_group_mapping fgm ON d.fan_id = fgm.fan_id
            JOIN 
                ventil_house h ON fgm.house_id = h.id
            GROUP BY 
                h.user_id, fgm.fan_id;
            `;
            const energyResult = await AppDataSource3.query(energyInfoSql, [startdate, end_date]);
            //const energyResult = await db.execute(energyInfoSql, [startdate, end_date]).then((result) => result[0]);;

            //console.log("energyResult = ", energyResult);
            
            // 5) 에너지 사용량 계산 
            let totalruntime = 0 // 하루의 모든팬의 총구동시간 계산 
            for (const data of energyResult) {
                let runtime = Number(data.total_runtime_seconds); // 팬 별 구동시간 계산 
                
                if ( runtime == null) {
                    runtime = 0
                }
                totalruntime += runtime; // 하루의 모든팬의 총구동시간 계산 
            }

            console.log("하루의 모든팬의 총구동시간 = ", totalruntime);
            // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
            const wattage = (totalruntime / 3600) * 0.064;
            const kwh = parseFloat(wattage.toFixed(5))
            totalWattage += kwh; // 총 에너지 사용량 계산 

            // 사용시간 (시간 단위)
            const usedTime = Math.floor(totalruntime/ 3600);

            // 데이터 리스트에 추가
            dataList.push({
                startDate: startdate,
                energyUsage: kwh,   
                usedTime: usedTime,
            });
    }

    // 6) 최종 요금계산  에너지 사용량 계산 
    // 평균 소비량 계산 (14일 평균)
    const averageWattage = parseFloat((totalWattage / 14).toFixed(5));

    // 최종 리턴 데이터     // 14일간의 일별 에너지 계산 결과 리턴 
    const returnList = {
        userCount: usersResult.total_users,
        fanCount: usersResult.total_fans,
        dataList: dataList,
        totalWattage: totalWattage,
        averageWattage: averageWattage
    }

    console.log("returnlist = ", returnList);
    return returnList;
}

// ✅ 5. 유동팬 전체 주간 에너지통계 조회      // 최근 14주간의 주별 에너지 계산 
export async function totalWeekEnergyInfo(info) {
    console.log(" ✅ 5. 전체 주간 에너지통계 조회");
    
    // 1) 날짜 정보 조회 
    const date = info.start_week;
    const dataList = [];

    // 2) 사용자 정보 조회 
    const usersSql =
        `SELECT 
            COUNT(DISTINCT u.id) AS total_users,
            COUNT(DISTINCT f.id) AS total_fans,
            AVG(u.standard_rate) AS avg_standard_rate
        FROM 
            Fanzic.user u
        LEFT JOIN 
            Fanzic.ventil_house h ON h.user_id = u.id AND h.deleted_flag = 0
        LEFT JOIN 
            Fanzic.ventil_fan_group_mapping fgm ON fgm.house_id = h.id
        LEFT JOIN 
            Fanzic.ventil_fan f ON f.id = fgm.fan_id AND f.deleted_flag = 0
        WHERE 
            u.id IS NOT NULL;
        `;
    const usersResultArr = await AppDataSource3.query(usersSql);
    const usersResult = usersResultArr[0];

    // 3) 에너지 통계 조회  //💡 14주간의 주별 에너지 계산
    let totalWattage = 0; // 총 에너지 사용량 계산 
    for (let i = 0; i < 14; i++) {
        const pastDate = subWeeks(new Date(date), i);  // i주 전 날짜 계산
        // 해당 주의 시작과 종료 날짜 계산
        const startOfTheWeek = startOfWeek(pastDate, { weekStartsOn: 1 }); // 월요일 시작
        const endOfTheWeek = endOfWeek(pastDate, { weekStartsOn: 1 });
        // UTC 시간으로 변환
        const startOfTheWeekUTC = new Date(startOfTheWeek.getTime() - startOfTheWeek.getTimezoneOffset() * 60 * 1000);
        const endOfTheWeekUTC = new Date(endOfTheWeek.getTime() - endOfTheWeek.getTimezoneOffset() * 60 * 1000);

        console.log(`Week Query Range: ${startOfTheWeekUTC.toISOString()} - ${endOfTheWeekUTC.toISOString()}`);
        // 4) 해당 주의 팬 구동 시간 및 에너지 사용량 계산 ( 4번의 구동시간 쿼리 반복됨 )
        const energyInfoSql = 
            `WITH FanOnOffPairs AS (
                SELECT 
                    fcl_on.fan_id,
                    fcl_on.time_stamp AS fan_on_time,
                    MIN(fcl_off.time_stamp) AS fan_off_time
                FROM 
                    ventil_fan_control_log fcl_on
                LEFT JOIN 
                    ventil_fan_control_log fcl_off
                ON 
                    fcl_on.fan_id = fcl_off.fan_id
                    AND fcl_off.command = 'fan-off'
                    AND fcl_off.time_stamp > fcl_on.time_stamp
                WHERE 
                    fcl_on.command = 'fan-on'
                    AND fcl_on.time_stamp BETWEEN ? AND ?
                GROUP BY 
                    fcl_on.fan_id, fcl_on.time_stamp
            ),
            Durations AS (
                SELECT 
                    fan_id,
                    TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
                FROM 
                    FanOnOffPairs
                WHERE 
                    fan_off_time IS NOT NULL 
            )
            SELECT 
                h.user_id,
                fgm.fan_id,
                SUM(d.duration_seconds) AS total_runtime_seconds
            FROM 
                Durations d
            JOIN 
                ventil_fan_group_mapping fgm ON d.fan_id = fgm.fan_id
            JOIN 
                ventil_house h ON fgm.house_id = h.id
            GROUP BY 
                h.user_id, fgm.fan_id;
            `;
        const energyResult = await AppDataSource3.query(energyInfoSql, [startOfTheWeekUTC, endOfTheWeekUTC]);
        
        // 5) 에너지 사용량 계산 
        let totalruntime = 0 // 해당 주의 모든팬의 총구동시간 계산 
        for (const data of energyResult) {
            let runtime = Number(data.total_runtime_seconds); // 팬 별 구동시간 계산 
            
            if ( runtime == null) {
                runtime = 0
            }
            totalruntime += runtime; // 해당 주의 모든팬의 총구동시간 계산 
        }

        console.log("그 주의 모든팬의 총구동시간 = ", totalruntime);
        // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
        const wattage = (totalruntime / 3600) * 0.064;
        const kwh = parseFloat(wattage.toFixed(5));
        totalWattage += kwh; // 총 에너지 사용량 계산 

        // 사용시간 (시간 단위)
        const usedTime = Math.floor(totalruntime/ 3600);

        // 데이터 리스트에 추가
        dataList.push({
            startDate: startOfTheWeekUTC.toISOString().split('T')[0],
            usedTime: usedTime,
            energyUsage: kwh
        });
    }

    // 6) 최종 요금계산  에너지 사용량 계산 
    // 평균 소비량 계산 (14주 평균)
    const averageWattage = parseFloat((totalWattage / 14).toFixed(5));

    // 최종 리턴 데이터     // 14주간의 주별 에너지 계산 결과 리턴 
    const returnList = {
        userCount: usersResult.total_users,
        fanCount: usersResult.total_fans,
        dataList: dataList,
        totalWattage: parseFloat(totalWattage.toFixed(5)),
        averageWattage: averageWattage
    }
    console.log("returnlist = ", returnList);
    return returnList;
}

// ✅ 6. 유동팬 전체 월간 에너지통계 조회   // 최근 12개월간의 월별 에너지 계산 
export async function totalMonthEnergyInfo(info) {
    console.log(" ✅ 6. 전체 월간 에너지통계 조회");
    
    // 1) 날짜 정보 조회 
    const date = info.start_month;
    const dataList = [];

    // 2) 사용자 정보 조회 
    const usersSql =
        `SELECT 
            COUNT(DISTINCT u.id) AS total_users,
            COUNT(DISTINCT f.id) AS total_fans,
            AVG(u.standard_rate) AS avg_standard_rate
        FROM 
            Fanzic.user u
        LEFT JOIN 
            Fanzic.ventil_house h ON h.user_id = u.id AND h.deleted_flag = 0
        LEFT JOIN 
            Fanzic.ventil_fan_group_mapping fgm ON fgm.house_id = h.id
        LEFT JOIN 
            Fanzic.ventil_fan f ON f.id = fgm.fan_id AND f.deleted_flag = 0
        WHERE 
            u.id IS NOT NULL;
        `;
    const usersResultArr = await AppDataSource3.query(usersSql);
    const usersResult = usersResultArr[0];

    // 3) 에너지 통계 조회  //💡 12개월간의 월별 에너지 계산
    let totalWattage = 0; // 총 에너지 사용량 계산 
    for (let i = 0; i < 12; i++) {
        const pastDate = subMonths(date, i);  // i개월 전 날짜 계산
        console.log("과거 월 = ", pastDate);
        const startOfTheMonth = startOfMonth(pastDate); // 해당 월의 첫째 날
        const nextStartOfTheMonth = addDays(startOfTheMonth, 1); //(1일을2일로 변경 monthEnergyInfo도 동일 날짜수때문일듯한데..)
        const RealStartOfTheMonth = nextStartOfTheMonth.toISOString().split('T')[0];
        const end = endOfMonth(pastDate); // 해당 월의 마지막 날
        const endOfTheMonth = end.toISOString().split('T')[0];

        // 4) 해당 월의 팬 구동 시간 및 에너지 사용량 계산 ( 💡  )
        const energyInfoSql = 
        `WITH FanOnOffPairs AS (
            SELECT 
                fcl_on.fan_id,
                fcl_on.time_stamp AS fan_on_time,
                MIN(fcl_off.time_stamp) AS fan_off_time
            FROM 
                ventil_fan_control_log fcl_on
            LEFT JOIN 
                ventil_fan_control_log fcl_off
            ON 
                fcl_on.fan_id = fcl_off.fan_id
                AND fcl_off.command = 'fan-off'
                AND fcl_off.time_stamp > fcl_on.time_stamp
            WHERE 
                fcl_on.command = 'fan-on'
                AND fcl_on.time_stamp BETWEEN ? AND ?
            GROUP BY 
                fcl_on.fan_id, fcl_on.time_stamp
        ),
        Durations AS (
            SELECT 
                fan_id,
                TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
            FROM 
                FanOnOffPairs
            WHERE 
                fan_off_time IS NOT NULL 
        )
        SELECT 
            h.user_id,
            fgm.fan_id,
            SUM(d.duration_seconds) AS total_runtime_seconds
        FROM 
            Durations d
        JOIN 
            ventil_fan_group_mapping fgm ON d.fan_id = fgm.fan_id
        JOIN 
            ventil_house h ON fgm.house_id = h.id
        GROUP BY 
            h.user_id, fgm.fan_id;
        `;
        const energyResult = await AppDataSource3.query(energyInfoSql, [RealStartOfTheMonth, endOfTheMonth]);
        
        // 5) 에너지 사용량 계산 
        let totalruntime = 0 // 해당 월의 모든팬의 총구동시간 계산 
        for (const data of energyResult) {
            let runtime = Number(data.total_runtime_seconds); // 팬 별 구동시간 계산 
            
            if ( runtime == null) {
                runtime = 0
            }
            totalruntime += runtime; // 해당 월의 모든팬의 총구동시간 계산 
        }
        
        // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
        const wattage = (totalruntime / 3600) * 0.064;
        const kwh = parseFloat(wattage.toFixed(5))
        totalWattage += kwh; // 총 에너지 사용량 계산 

        // 사용시간 (시간 단위)
        const usedTime = Math.floor(totalruntime / 3600)

        // 데이터 리스트에 추가
        dataList.push({
            startDate: RealStartOfTheMonth,
            usedTime: usedTime,
            energyUsage: kwh
        });
    }

    // 6) 최종 요금계산  에너지 사용량 계산 
    // 평균 소비량 계산 (12개월 평균)
    const averageWattage = parseFloat((totalWattage / 12).toFixed(5)); // 왜 12달인데 14로 나누지? 그리고 요금은 계산안하나?
    
    // 최종 리턴 데이터     // 12개월간의 월별 에너지 계산 결과 리턴 
    const returnList = {
        userCount: usersResult.total_users,
        fanCount: usersResult.total_fans,
        dataList: dataList,
        totalWattage: totalWattage,
        averageWattage: averageWattage
    }

    console.log("returnlist = ", returnList);
    return returnList;
}

// ✅ 7. 유동팬 하우스별 일간 에너지통계 조회 
export async function houseDayEnergyInfo(info) {
    console.log(" ✅ 7. 하우스별 일간 에너지통계 조회");
    
    // 1) 날짜 정보 조회 
    const today = info.start_date;
    const dataList = [];
    
    // 2) 사용자 정보 조회 
    const user_id = await userRepository3.findOne({ where: [{ username: info.userId }, { name: info.userId }] });

    if( !user_id ){
        //console.log("없는 사용자 입니다.");
        return { message : "없는 사용자 입니다."};
    }
    // 사용자 기본 정보 + 팬 개수 조회   
    const usersSql = 
            `SELECT 
                u.id AS user_id,
                u.username,
                u.name,
                u.standard_rate,
                COUNT(CASE WHEN fgm.fan_deleted = 0 THEN fgm.fan_id END) AS fanCount	-- 하우스랑 매핑 안된건 안찾겠다는건가 
            FROM 
                Fanzic.user u
            LEFT JOIN 
                Fanzic.ventil_house h ON u.id = h.user_id AND h.deleted_flag = 0
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            WHERE
                u.id = ?
            GROUP BY 
                u.id;`;
    
    // Get userId
    const usersResult = await db.execute(usersSql, [user_id.id]).then((result) => result[0][0]);

    // 3) 작업장 정보 조회 
    const houseSql = 
                `SELECT 
                h.id AS house_id,
                h.name AS house_name,
                h.order AS house_order_num,
                COUNT(DISTINCT f.id) AS fan_count
            FROM 
                Fanzic.ventil_house h
            LEFT JOIN 
                Fanzic.ventil_group fg ON h.id = fg.house_id
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            LEFT JOIN
                Fanzic.ventil_fan f ON f.id = fgm.fan_id AND f.deleted_flag = 0
            WHERE 
                h.user_id = ?
                AND h.deleted_flag = 0
            GROUP BY 
                h.id, h.name, h.order
            ORDER BY 
                h.order ASC;
            `;
    const houseResult = await db.execute(houseSql, [user_id.id]).then((result) => result[0]);
    const houseList = houseResult.map(house => ({
        id: house.house_id,
        name: house.house_name,
        houseOrderNum: house.house_order_num,
        getFanNum: house.fan_count
        })
    );
    
    // 4) 에너지 통계 조회  //💡 14일간의 일별 에너지 계산
    let totalWattage = 0; // 총 에너지 사용량 계산 
    for (let i = 0; i < 14; i++) {
        const dateObj = subDays(today, i);
        // 해당 날짜의 시작과 종료 날짜 계산
        const startdate = `${dateObj.toISOString().split('T')[0]} 00:00:00`;
        const end_date = `${dateObj.toISOString().split('T')[0]} 23:59:59`;

        // 5) 해당 날짜의 팬 구동 시간 및 에너지 사용량 계산 ( 유저 + 하우스 / 7,8 같음) 
        const energyInfoSql = 
        `WITH FanOnOffPairs AS (
                    SELECT 
                        fcl_on.fan_id,
                        fcl_on.time_stamp AS fan_on_time,
                        MIN(fcl_off.time_stamp) AS fan_off_time
                    FROM 
                        ventil_fan_control_log fcl_on
                    LEFT JOIN 
                        ventil_fan_control_log fcl_off
                    ON 
                        fcl_on.fan_id = fcl_off.fan_id
                        AND fcl_off.command = 'fan-off'
                        AND fcl_off.time_stamp > fcl_on.time_stamp
                    WHERE 
                        fcl_on.command = 'fan-on'
                        AND fcl_on.time_stamp BETWEEN ? AND ?
                    GROUP BY 
                        fcl_on.fan_id, fcl_on.time_stamp
                ),
                Durations AS (
                    SELECT 
                        fan_id,
                        TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
                    FROM 
                        FanOnOffPairs
                    WHERE 
                        fan_off_time IS NOT NULL 
                )
                SELECT 
                    h.user_id,
                    fgm.fan_id,
                    SUM(d.duration_seconds) AS total_runtime_seconds
                FROM 
                    Durations d
                JOIN 
                    ventil_fan_group_mapping fgm ON d.fan_id = fgm.fan_id
                JOIN 
                    ventil_house h ON fgm.house_id = h.id
                WHERE 
                    h.user_id = ? AND h.id = ?
                GROUP BY 
                    h.user_id, fgm.fan_id;
                `;

             const energyResult = await AppDataSource3.query(energyInfoSql, [startdate, end_date, user_id.id, info.houseId]);
              //    const energyResult = await db.execute(energyInfoSql, [startdate, end_date, user_id.id, info.houseId]).then((result) => result[0]);
            //console.log("energyResult = ", energyResult);
            
            // 5) 에너지 사용량 계산 
            let totalruntime = 0 // 해당 날짜의 모든팬의 총구동시간 계산 
            for (const data of energyResult) {
                let runtime = Number(data.total_runtime_seconds); // 팬 별 구동시간 계산 
                
                if ( runtime == null) {
                    runtime = 0
                }
                totalruntime += runtime; // 해당 날짜의 모든팬의 총구동시간 계산 
            }

            console.log("하루의 모든팬의 총구동시간 = ", totalruntime);
            // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
            const wattage = (totalruntime / 3600) * 0.064;
            const kwh = parseFloat(wattage.toFixed(5))
            totalWattage += kwh; // 총 에너지 사용량 계산 

            // 사용시간 (시간 단위)
            const usedTime = Math.floor(totalruntime/ 3600);

            // 데이터 리스트에 추가
            dataList.push({
                startDate: startdate,
                energyUsage: kwh,
                usedTime: usedTime,
            });
        }

        // 6) 최종 요금계산  에너지 사용량 계산 
        // 총 요금 계산 
        const totalCharge = totalWattage * usersResult.standard_rate
        // 평균 소비량 계산 (14일 평균)
        const averageWattage = parseFloat((totalWattage / 14).toFixed(5));
        // 평균 요금 계산 (14일 평균)   
        const averageCharge = parseFloat((totalCharge / 14).toFixed(5));

        // 최종 리턴 데이터     // 14일간의 일별 에너지 계산 결과 리턴  
            const returnList = {
            id : user_id.id,
            userId: usersResult.userID,
            houseList: houseList,
            fanCount : usersResult.fanCount,
            standard_rate: usersResult.standard_rate,
            totalWattage: totalWattage,
            averageWattage: averageWattage,
            charges: new Intl.NumberFormat('en-US').format(totalCharge),
            averageCharge: new Intl.NumberFormat('en-US').format(averageCharge),
            dataList: dataList               
        }

        console.log("returnList = ", returnList)
        return returnList;

}
// ✅ 8. 유동팬 하우스별 주간 에너지통계 조회
export async function houseWeekEnergyInfo(info) {
    console.log(" ✅ 8. 하우스별 주간 에너지통계 조회");
    
    // 1) 날짜 정보 조회 
    const date = info.start_week;
    const dataList = [];
    
    // 2) 사용자 정보 조회 
    const user_id = await userRepository3.findOne({ where: [{ username: info.userId }, { name: info.userId }] });

    if( !user_id ){
        //console.log("없는 사용자 입니다.");
        return { message : "없는 사용자 입니다."};
    }
    // 사용자 기본 정보 + 팬 개수 조회   
    const usersSql = 
            `SELECT 
                u.id AS user_id,
                u.username,
                u.name,
                u.standard_rate,
                COUNT(CASE WHEN fgm.fan_deleted = 0 THEN fgm.fan_id END) AS fanCount	-- 하우스랑 매핑 안된건 안찾겠다는건가 
            FROM 
                Fanzic.user u
            LEFT JOIN 
                Fanzic.ventil_house h ON u.id = h.user_id AND h.deleted_flag = 0
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            WHERE
                u.id = ?
            GROUP BY 
                u.id;`;
    
    // Get userId
    const usersResult = await db.execute(usersSql, [user_id.id]).then((result) => result[0][0]);

    // 3) 작업장 정보 조회   
    const houseSql = 
                `SELECT 
                h.id AS house_id,
                h.name AS house_name,
                h.order AS house_order_num,
                COUNT(DISTINCT f.id) AS fan_count
            FROM 
                Fanzic.ventil_house h
            LEFT JOIN 
                Fanzic.ventil_group fg ON h.id = fg.house_id
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            LEFT JOIN
                Fanzic.ventil_fan f ON f.id = fgm.fan_id AND f.deleted_flag = 0
            WHERE 
                h.user_id = ?
                AND h.deleted_flag = 0
            GROUP BY 
                h.id, h.name, h.order
            ORDER BY 
                h.order ASC;
            `;
    const houseResult = await db.execute(houseSql, [user_id.id]).then((result) => result[0]);;
    const houseList = houseResult.map(house => ({
        id: house.house_id,
        name: house.house_name,
        houseOrderNum: house.house_order_num,
        getFanNum: house.fan_count
        })
    );

    // 4) 에너지 통계 조회  //💡 14일간의 주별 에너지 계산
    let totalWattage = 0; // 총 에너지 사용량 계산 
    for (let i = 0; i < 14; i++) {
        const pastDate = subWeeks(new Date(date), i); // i주 전 날짜 계산
        console.log("과거 일 = ", pastDate);
        const startOfTheWeek = startOfWeek(pastDate, { weekStartsOn: 1 }); // 월요일 시작
        const endOfTheWeek = endOfWeek(pastDate, { weekStartsOn: 1 });
        const startOfTheWeekUTC = new Date(startOfTheWeek.getTime() - startOfTheWeek.getTimezoneOffset() * 60 * 1000);
        const endOfTheWeekUTC = new Date(endOfTheWeek.getTime() - endOfTheWeek.getTimezoneOffset() * 60 * 1000);

        //console.log(`Week Query Range: ${startOfTheWeekUTC.toISOString()} - ${endOfTheWeekUTC.toISOString()}`);   // 주별 쿼리 조건 추가 
        // 5) 해당 주의 팬 구동 시간 및 에너지 사용량 계산 ( 유저 + 하우스 / 7,8 같음) 
        const energyInfoSql = 
            `WITH FanOnOffPairs AS (
                SELECT 
                    fcl_on.fan_id,
                    fcl_on.time_stamp AS fan_on_time,
                    MIN(fcl_off.time_stamp) AS fan_off_time
                FROM 
                    ventil_fan_control_log fcl_on
                LEFT JOIN 
                    ventil_fan_control_log fcl_off
                ON 
                    fcl_on.fan_id = fcl_off.fan_id
                    AND fcl_off.command = 'fan-off'
                    AND fcl_off.time_stamp > fcl_on.time_stamp
                WHERE 
                    fcl_on.command = 'fan-on'
                    AND fcl_on.time_stamp BETWEEN ? AND ?
                GROUP BY 
                    fcl_on.fan_id, fcl_on.time_stamp
            ),
            Durations AS (
                SELECT 
                    fan_id,
                    TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
                FROM 
                    FanOnOffPairs
                WHERE 
                    fan_off_time IS NOT NULL 
            )
            SELECT 
                h.user_id,
                fgm.fan_id,
                SUM(d.duration_seconds) AS total_runtime_seconds
            FROM 
                Durations d
            JOIN 
                ventil_fan_group_mapping fgm ON d.fan_id = fgm.fan_id
            JOIN 
                ventil_house h ON fgm.house_id = h.id
            WHERE 
                h.user_id = ? AND h.id = ?
            GROUP BY 
                h.user_id, fgm.fan_id;
            `;
        const energyResult = await AppDataSource3.query(energyInfoSql, [startOfTheWeekUTC, endOfTheWeekUTC, user_id.id, info.houseId]);
        //console.log("energyResult = ", energyResult);
        // 5) 에너지 사용량 계산 
        let totalruntime = 0 // 해당 주의 모든팬의 총구동시간 계산 
        let runtime = 0
        for (const data of energyResult) {
            runtime = Number(data.total_runtime_seconds); // 팬 별 구동시간 계산 
            
            if ( runtime == null) {
                runtime = 0
            }
            totalruntime += runtime; // 해당 주의 모든팬의 총구동시간 계산 
        }

        // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
        const wattage = (totalruntime / 3600) * 0.064;
        const kwh = parseFloat(wattage.toFixed(5))
        totalWattage += kwh; // 총 에너지 사용량 계산 

        // 사용시간 (시간 단위)
        const usedTime = Math.floor(totalruntime/ 3600);
        
        console.log("그주의 모든팬의 총구동시간 = ", totalruntime);
        // 데이터 리스트에 추가
        dataList.push({
            startDate: startOfTheWeekUTC.toISOString().split('T')[0],
            energyUsage: kwh,
            usedTime: usedTime
        });
    }

    // 6) 최종 요금계산  에너지 사용량 계산 
    // 총 요금 계산 
    const totalCharge = totalWattage * usersResult.standard_rate
    // 평균 소비량 계산 (14일 평균)
    const averageWattage = parseFloat((totalWattage / 14).toFixed(5));
    // 평균 요금 계산 (14일 평균)   

    const averageCharge = parseFloat((totalCharge / 14).toFixed(5));

    // 최종 리턴 데이터     // 14일간의 일별 에너지 계산 결과 리턴 
    const returnList = {
        id : user_id.id,
        userId: usersResult.userID,
        houseList: houseList,
        fanCount : usersResult.fanCount,
        standard_rate: usersResult.standard_rate,
        totalWattage: totalWattage,
        averageWattage: averageWattage,
        charges: new Intl.NumberFormat('en-US').format(totalCharge),    // 총 요금  
        averageCharge: new Intl.NumberFormat('en-US').format(averageCharge), // 평균 요금
        dataList: dataList        // 14일간의 일별 에너지 계산 결과 리턴 
    }

    return returnList;
}

// ✅ 9. 유동팬 하우스별 월간 에너지통계 조회 
export async function houseMonthEnergyInfo(info) {
    console.log(" ✅ 9. 하우스별 월간 에너지통계 조회");
    
    // 1) 날짜 정보 조회 
    const date = info.start_month; 
    const dataList = [];
    // 2) 사용자 정보 조회 
    const user_id = await userRepository3.findOne({ where: [{ username: info.userId }, { name: info.userId }] });

    if( !user_id ){
        //console.log("없는 사용자 입니다.");
        return { message : "없는 사용자 입니다."};
    }
    // 사용자 기본 정보 + 팬 개수 조회   
    const usersSql = 
            `SELECT 
                u.id AS user_id,
                u.username,
                u.name,
                u.standard_rate,
                COUNT(CASE WHEN fgm.fan_deleted = 0 THEN fgm.fan_id END) AS fanCount	-- 하우스랑 매핑 안된건 안찾겠다는건가 
            FROM 
                Fanzic.user u
            LEFT JOIN 
                Fanzic.ventil_house h ON u.id = h.user_id AND h.deleted_flag = 0
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            WHERE
                u.id = ?
            GROUP BY 
                u.id;`;

    // Get userId
    const usersResult = await db.execute(usersSql, [user_id.id]).then((result) => result[0][0]);

    // 3) 작업장 정보 조회 
    const houseSql = 
                `SELECT 
                h.id AS house_id,
                h.name AS house_name,
                h.order AS house_order_num,
                COUNT(DISTINCT f.id) AS fan_count
            FROM 
                Fanzic.ventil_house h
            LEFT JOIN 
                Fanzic.ventil_group fg ON h.id = fg.house_id
            LEFT JOIN 
                Fanzic.ventil_fan_group_mapping fgm ON h.id = fgm.house_id
            LEFT JOIN
                Fanzic.ventil_fan f ON f.id = fgm.fan_id AND f.deleted_flag = 0
            WHERE 
                h.user_id = ?
                AND h.deleted_flag = 0
            GROUP BY 
                h.id, h.name, h.order
            ORDER BY 
                h.order ASC;
            `;
        
    const houseResult = await db.execute(houseSql, [user_id.id]).then((result) => result[0]);
    const houseList = houseResult.map(house => ({
        id: house.house_id,
        name: house.house_name,
        houseOrderNum: house.house_order_num,
        getFanNum: house.fan_count
        })
    );


    // 4) 에너지 통계 조회  //💡 12개월간의 월별 에너지 계산
    let totalWattage = 0; // 총 에너지 사용량 계산 
    for (let i = 0; i < 12; i++) {
        const pastDate = subMonths(date, i);  // i개월 전 날짜 계산
        const startOfTheMonth = startOfMonth(pastDate); // 해당 월의 첫째 날
        const nextStartOfTheMonth = addDays(startOfTheMonth, 1);
        const RealStartOfTheMonth = nextStartOfTheMonth.toISOString().split('T')[0];

        const end = endOfMonth(pastDate); // 해당 월의 마지막 날
        const endOfTheMonth = end.toISOString().split('T')[0];
        const energyInfoSql = 
        `WITH FanOnOffPairs AS (
            SELECT 
                fcl_on.fan_id,
                fcl_on.time_stamp AS fan_on_time,
                MIN(fcl_off.time_stamp) AS fan_off_time
            FROM 
                ventil_fan_control_log fcl_on
            LEFT JOIN 
                ventil_fan_control_log fcl_off
            ON 
                fcl_on.fan_id = fcl_off.fan_id
                AND fcl_off.command = 'fan-off'
                AND fcl_off.time_stamp > fcl_on.time_stamp
            WHERE 
                fcl_on.command = 'fan-on'
                AND fcl_on.time_stamp BETWEEN ? AND ?
            GROUP BY 
                fcl_on.fan_id, fcl_on.time_stamp
        ),
        Durations AS (
            SELECT 
                fan_id,
                TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
            FROM 
                FanOnOffPairs
            WHERE 
                fan_off_time IS NOT NULL 
        )
        SELECT 
            h.user_id,
            fgm.fan_id,
            SUM(d.duration_seconds) AS total_runtime_seconds
        FROM 
            Durations d
        JOIN 
            ventil_fan_group_mapping fgm ON d.fan_id = fgm.fan_id
        JOIN 
            ventil_house h ON fgm.house_id = h.id
        WHERE 
            h.user_id = ? AND h.id = ?
        GROUP BY 
            h.user_id, fgm.fan_id;
        `;
    
        const energyResult = await AppDataSource3.query(energyInfoSql, [RealStartOfTheMonth, endOfTheMonth, user_id.id, info.houseId]);
        //const energyResult = await db.execute(energyInfoSql, [RealStartOfTheMonth, endOfTheMonth, user_id.id, info.houseId]).then((result) => result[0]);
        //console.log("energyResult = ", energyResult);
        // 5) 에너지 사용량 계산 
        let totalruntime = 0 // 해당 월의 모든팬의 총구동시간 계산 
        let runtime = 0
        for (const data of energyResult) {
            runtime = Number(data.total_runtime_seconds); // 팬 별 구동시간 계산 
            
            if ( runtime == null) {
                runtime = 0
            }
            totalruntime += runtime; // 해당 월의 모든팬의 총구동시간 계산 
        }

        // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
        const wattage = (totalruntime / 3600) * 0.064;
        const kwh = parseFloat(wattage.toFixed(5));
        totalWattage += kwh; // 총 에너지 사용량 계산 

        // 사용시간 (시간 단위)
        const usedTime = Math.floor(totalruntime / 3600);

        // 데이터 리스트에 추가
        dataList.push({
            startDate: RealStartOfTheMonth,
            usedTime: usedTime,
            energyUsage: kwh
        });
    }

    // 6) 최종 요금계산  에너지 사용량 계산 
    // 평균 소비량 계산 (12개월 평균)
    const totalCharge = totalWattage * usersResult.standard_rate
    const averageWattage = parseFloat((totalWattage / 14).toFixed(5));  // 왜 14로 나누지? 12개월인데?
    // 평균 요금 계산 (12개월 평균)   
    const averageCharge = parseFloat((totalCharge / 14).toFixed(5));

    // 최종 리턴 데이터     // 12개월간의 월별 에너지 계산 결과 리턴 
    const returnList = {
        id : user_id.id,
        userId: usersResult.userID,
        houseList: houseList,
        fanCount : usersResult.fanCount,
        standard_rate: usersResult.standard_rate,
        totalWattage: totalWattage,
        averageWattage: averageWattage,
        charges: new Intl.NumberFormat('en-US').format(totalCharge),
        averageCharge: new Intl.NumberFormat('en-US').format(averageCharge),
        dataList: dataList                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
    }

    console.log(returnList);
    return returnList;
}

// ======================================== 
// 📊 관리자 - 통계 페이지 - 실링팬
// ========================================

// ✅ 1. 유저별 일간 에너지통계 조회 (ceiling_fan)
export async function ceiling_dayEnergyInfo(info) {
  console.log(" ✅ 1. ceiling_fan 유저별 일간 에너지통계 조회");
  const today = info.start_date;
  const dataList = [];

  // 1) 사용자 정보 조회
  // 사용자 ID로 사용자 찾기 (userID or name으로 검색 )
  const user_id = await userRepository3.findOne({ where: [{ username: info.userId }, { name: info.userId }] });

  if( !user_id ){
        //console.log("없는 사용자 입니다.");
        return { message : "없는 사용자 입니다."};
  }

  // 사용자 기본 정보(이름, 요금비율) + 팬 개수 조회
  const usersSql =
    `SELECT 
        u.id AS user_id,
        u.username,
        u.name AS user_name,
        u.standard_rate,
        COUNT(DISTINCT f.id) AS fan_count
    FROM 
        user u
    LEFT JOIN 
        ceiling_house h ON h.user_id = u.id AND h.deleted_flag = 0
	LEFT JOIN 
        ceiling_gate gate ON gate.house_id = h.id
	LEFT JOIN 
        ceiling_fan f ON f.gate_id = gate.id AND f.deleted_flag = 0
    WHERE 
        u.id = ?
    GROUP BY 
        u.id, u.username, u.name
    ORDER BY 
        u.id;`;
  const usersResultArr = await AppDataSource3.query(usersSql, [user_id.id]);
  const usersResult = usersResultArr[0];

  // 2) 작업장 정보 조회
  const houseSql =
    `SELECT 
        h.id AS house_id,
        h.name AS house_name,
        h.order AS house_order_num,
    --  h.user_id,
        COUNT(DISTINCT f.id) AS fan_count
    FROM 
        ceiling_house h
 	LEFT JOIN 
        ceiling_gate gate ON gate.house_id = h.id
	LEFT JOIN 
        ceiling_fan f ON f.gate_id = gate.id
        AND f.deleted_flag = 0
    WHERE 
        h.user_id = ?
        AND h.deleted_flag = 0
    GROUP BY 
        h.id, h.name, h.order, h.user_id
    ORDER BY 
        h.order ASC;
    `;
  const houseResult = await AppDataSource3.query(houseSql, [user_id.id]);

  const houseList = houseResult.map(house => ({
    id: house.house_id,
    name: house.house_name,
    houseOrderNum: house.house_order_num,
    getFanNum: house.fan_count
  }));

  // 3) 에너지 통계 조회  //💡 14일간의 일별 에너지 계산
  let totalWattage = 0;
  for (let i = 0; i < 14; i++) {
    const dateObj = subDays(today, i);
    const startdate = `${dateObj.toISOString().split('T')[0]} 00:00:00`;
    const end_date = `${dateObj.toISOString().split('T')[0]} 23:59:59`;
    const energyInfoSql =
      `WITH FanOnOffPairs AS (
        SELECT 
          fcl_on.fan_id,
          fcl_on.time_stamp AS fan_on_time,
          MIN(fcl_off.time_stamp) AS fan_off_time
        FROM 
          ceiling_fan_control_log fcl_on
        LEFT JOIN 
          ceiling_fan_control_log fcl_off
        ON 
          fcl_on.fan_id = fcl_off.fan_id
          AND fcl_off.command = 'fan-off'
          AND fcl_off.time_stamp > fcl_on.time_stamp
        WHERE 
          fcl_on.command = 'fan-on'
          AND fcl_on.time_stamp BETWEEN ? AND ?
        GROUP BY 
          fcl_on.fan_id, fcl_on.time_stamp
      ),
      Durations AS (
        SELECT 
          fan_id,
          TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
        FROM 
          FanOnOffPairs
        WHERE 
          fan_off_time IS NOT NULL 
      )
      SELECT 
        h.user_id,
        d.fan_id,
        SUM(d.duration_seconds) AS total_runtime_seconds
      FROM 
        Durations d
    JOIN 
        ceiling_fan f ON d.fan_id = f.id
    JOIN 
        ceiling_gate g ON f.gate_id = g.id
    JOIN 
        ceiling_house h ON g.house_id = h.id
      WHERE 
        h.user_id = ?
      GROUP BY 
        h.user_id, d.fan_id
      ORDER BY 
        d.fan_id;`;
    const energyResult = await AppDataSource3.query(energyInfoSql, [startdate, end_date, user_id.id]);
    let totalruntime = 0;
    for (const data of energyResult) {
      let runtime = Number(data.total_runtime_seconds);
      if (runtime == null) {
        runtime = 0;
      }
      totalruntime += runtime;
    }
    const wattage = (totalruntime / 3600) * 0.064;
    const kwh = parseFloat(wattage.toFixed(5));
    totalWattage += kwh;
    const usedTime = Math.floor(totalruntime / 3600);
    dataList.push({
      startDate: startdate,
      energyUsage: kwh,
      usedTime: usedTime,
    });
  }
  //console.log("usersResult.standard_rate 요금비율 = " + usersResult.standard_rate);
  // 4) 최종 요금계산  에너지 사용량 계산 
  const totalCharge = totalWattage * usersResult.standard_rate;
  // 평균 소비량 계산 (14일간의 평균)
  const averageWattage = parseFloat((totalWattage / 14).toFixed(5));
  // 평균 요금 계산 (14일간의 평균)
  const averageCharge = parseFloat((totalCharge / 14).toFixed(5));

  const returnList = {
    id: user_id.id,
    userId: usersResult.username,
    houseList: houseList,
    fanCount: usersResult.fan_count,
    standard_rate: usersResult.standard_rate,
    totalWattage: totalWattage,
    averageWattage: averageWattage,
    charges: new Intl.NumberFormat('en-US').format(totalCharge),
    averageCharge: new Intl.NumberFormat('en-US').format(averageCharge),
    dataList: dataList
  };

  //console.log("returnList = ", returnList);
  return returnList;
}

// ✅ 2. 유저별 주간 에너지통계 조회 (ceiling_fan)
export async function ceiling_weekEnergyInfo(info) {
  console.log(" ✅ 2. ceiling_fan 유저별 주간 에너지통계 조회");
  const date = info.start_week;
  const dataList = [];

  // 1) 사용자 정보 조회
  const user_id = await userRepository3.findOne({ where: [{ username: info.userId }, { name: info.userId }] });

  if( !user_id ){
        //console.log("없는 사용자 입니다.");
        return { message : "없는 사용자 입니다."};
  }
  
  // 사용자 기본 정보 + 팬 개수 조회
  const usersSql =
    `SELECT 
        u.id AS user_id,
        u.username,
        u.name AS user_name,
        u.standard_rate,
        COUNT(DISTINCT f.id) AS fan_count
    FROM 
        user u
    LEFT JOIN 
        ceiling_house h ON h.user_id = u.id AND h.deleted_flag = 0
	LEFT JOIN 
        ceiling_gate gate ON gate.house_id = h.id
	LEFT JOIN 
        ceiling_fan f ON f.gate_id = gate.id AND f.deleted_flag = 0
    WHERE 
        u.id = ?
    GROUP BY 
        u.id, u.username, u.name
    ORDER BY 
        u.id;`;
  const usersResultArr = await AppDataSource3.query(usersSql, [user_id.id]);
  const usersResult = usersResultArr[0];

  // 2) 작업장 정보 조회
  const houseSql =
    `SELECT 
        h.id AS house_id,
        h.name AS house_name,
        h.order AS house_order_num,
        COUNT(DISTINCT f.id) AS fan_count
    FROM 
        ceiling_house h
 	LEFT JOIN 
        ceiling_gate gate ON gate.house_id = h.id
	LEFT JOIN 
        ceiling_fan f ON f.gate_id = gate.id
        AND f.deleted_flag = 0
    WHERE 
        h.user_id = ?
        AND (h.deleted_at IS NULL OR ? <= h.deleted_at)
    GROUP BY 
        h.id, h.name, h.order, h.user_id
    ORDER BY 
        h.order ASC;
    `;
  const houseResult = await AppDataSource3.query(houseSql, [user_id.id, date]);

  const houseList = houseResult.map(house => ({
    id: house.house_id,
    name: house.house_name,
    houseOrderNum: house.house_order_num,
    getFanNum: house.fan_count
  }));

  // 3) 에너지 통계 조회 - 14주간의 주별 에너지 계산
  let totalWattage = 0;
  for (let i = 0; i < 14; i++) {
    const weekStart = subWeeks(date, i);
    const weekEnd = endOfWeek(weekStart);
    const startdate = `${weekStart.toISOString().split('T')[0]} 00:00:00`;
    const end_date = `${weekEnd.toISOString().split('T')[0]} 23:59:59`;

    const energyInfoSql =
      `WITH FanOnOffPairs AS (
        SELECT 
          fcl_on.fan_id,
          fcl_on.time_stamp AS fan_on_time,
          MIN(fcl_off.time_stamp) AS fan_off_time
        FROM 
          ceiling_fan_control_log fcl_on
        LEFT JOIN 
          ceiling_fan_control_log fcl_off
        ON 
          fcl_on.fan_id = fcl_off.fan_id
          AND fcl_off.command = 'fan-off'
          AND fcl_off.time_stamp > fcl_on.time_stamp
        WHERE 
          fcl_on.command = 'fan-on'
          AND fcl_on.time_stamp BETWEEN ? AND ?
        GROUP BY 
          fcl_on.fan_id, fcl_on.time_stamp
      ),
      Durations AS (
        SELECT 
          fan_id,
          TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
        FROM 
          FanOnOffPairs
        WHERE 
          fan_off_time IS NOT NULL 
      )
      SELECT 
        h.user_id,
        d.fan_id,
        SUM(d.duration_seconds) AS total_runtime_seconds
      FROM 
        Durations d
    JOIN 
        ceiling_fan f ON d.fan_id = f.id
    JOIN 
        ceiling_gate g ON f.gate_id = g.id
    JOIN 
        ceiling_house h ON g.house_id = h.id
      WHERE 
        h.user_id = ?
      GROUP BY 
        h.user_id, d.fan_id
      ORDER BY 
        d.fan_id;`;
    const energyResult = await AppDataSource3.query(energyInfoSql, [startdate, end_date, user_id.id]);
    let totalruntime = 0;
    for (const data of energyResult) {
      let runtime = Number(data.total_runtime_seconds);
      if (runtime == null) {
        runtime = 0;
      }
      totalruntime += runtime;
    }
    const wattage = (totalruntime / 3600) * 0.064;
    const kwh = parseFloat(wattage.toFixed(5));
    totalWattage += kwh;
    const usedTime = Math.floor(totalruntime / 3600);
    dataList.push({
      startDate: startdate,
      energyUsage: kwh,
      usedTime: usedTime,
    });
  }

  const totalCharge = totalWattage * usersResult.standard_rate;
  const averageWattage = parseFloat((totalWattage / 14).toFixed(5));
  const averageCharge = parseFloat((totalCharge / 14).toFixed(5));

  const returnList = {
    id: user_id.id,
    userId: usersResult.username,
    houseList: houseList,
    fanCount: usersResult.fan_count,
    standard_rate: usersResult.standard_rate,
    totalWattage: totalWattage,
    averageWattage: averageWattage,
    charges: new Intl.NumberFormat('en-US').format(totalCharge),
    averageCharge: new Intl.NumberFormat('en-US').format(averageCharge),
    dataList: dataList
  };

  console.log("returnList = ", returnList);
  return returnList;
}

// ✅ 3. 유저별 월간 에너지통계 조회 (ceiling_fan)
export async function ceiling_monthEnergyInfo(info) {
  console.log(" ✅ 3. ceiling_fan 유저별 월간 에너지통계 조회");
  const date = info.start_month;
  const dataList = [];

  // 1) 사용자 정보 조회
  const user_id = await userRepository3.findOne({ where: [{ username: info.userId }, { name: info.userId }] });
  
  if( !user_id ){
        //console.log("없는 사용자 입니다.");
        return { message : "없는 사용자 입니다."};
  }
  
  // 사용자 기본 정보 + 팬 개수 조회
  const usersSql =
    `SELECT 
        u.id AS user_id,
        u.username,
        u.name AS user_name,
        u.standard_rate,
        COUNT(DISTINCT f.id) AS fan_count
    FROM 
         user u
    LEFT JOIN 
        ceiling_house h ON h.user_id = u.id AND h.deleted_flag = 0
	LEFT JOIN 
        ceiling_gate gate ON gate.house_id = h.id
	LEFT JOIN 
        ceiling_fan f ON f.gate_id = gate.id AND f.deleted_flag = 0
    WHERE 
        u.id = ?
    GROUP BY 
        u.id, u.username, u.name
    ORDER BY 
        u.id;`;
        
  const usersResultArr = await AppDataSource3.query(usersSql, [user_id.id]);
  const usersResult = usersResultArr[0];
  // 2) 작업장 정보 조회
  const houseSql =
    `SELECT 
        h.id AS house_id,
        h.name AS house_name,
        h.order AS house_order_num,
        COUNT(DISTINCT f.id) AS fan_count
    FROM 
        ceiling_house h
 	LEFT JOIN 
        ceiling_gate gate ON gate.house_id = h.id
	LEFT JOIN 
        ceiling_fan f ON f.gate_id = gate.id
        AND f.deleted_flag = 0
    WHERE 
        h.user_id = ?
        AND h.deleted_flag = 0
    GROUP BY 
        h.id, h.name, h.order, h.user_id
    ORDER BY 
        h.order ASC;
    `;
  const houseResult = await AppDataSource3.query(houseSql, [user_id.id]);

  const houseList = houseResult.map(house => ({
    id: house.house_id,
    name: house.house_name,
    houseOrderNum: house.house_order_num,
    getFanNum: house.fan_count
  }));

  // 3) 에너지 통계 조회 - 12개월간의 월별 에너지 계산
  let totalWattage = 0;
  for (let i = 0; i < 12; i++) {
    const monthStart = subMonths(date, i);
    const monthEnd = endOfMonth(monthStart);
    const startdate = `${monthStart.toISOString().split('T')[0]} 00:00:00`;
    const end_date = `${monthEnd.toISOString().split('T')[0]} 23:59:59`;

    const energyInfoSql =
      `WITH FanOnOffPairs AS (
        SELECT 
          fcl_on.fan_id,
          fcl_on.time_stamp AS fan_on_time,
          MIN(fcl_off.time_stamp) AS fan_off_time
        FROM 
          ceiling_fan_control_log fcl_on
        LEFT JOIN 
          ceiling_fan_control_log fcl_off
        ON 
          fcl_on.fan_id = fcl_off.fan_id
          AND fcl_off.command = 'fan-off'
          AND fcl_off.time_stamp > fcl_on.time_stamp
        WHERE 
          fcl_on.command = 'fan-on'
          AND fcl_on.time_stamp BETWEEN ? AND ?
        GROUP BY 
          fcl_on.fan_id, fcl_on.time_stamp
      ),
      Durations AS (
        SELECT 
          fan_id,
          TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
        FROM 
          FanOnOffPairs
        WHERE 
          fan_off_time IS NOT NULL 
      )
      SELECT 
        h.user_id,
        d.fan_id,
        SUM(d.duration_seconds) AS total_runtime_seconds
      FROM 
        Durations d
    JOIN 
        ceiling_fan f ON d.fan_id = f.id
    JOIN 
        ceiling_gate g ON f.gate_id = g.id
    JOIN 
        ceiling_house h ON g.house_id = h.id
      WHERE 
        h.user_id = ?
      GROUP BY 
        h.user_id, d.fan_id
      ORDER BY 
        d.fan_id;`;
    const energyResult = await AppDataSource3.query(energyInfoSql, [startdate, end_date, user_id.id]);
    let totalruntime = 0;
    for (const data of energyResult) {
      let runtime = Number(data.total_runtime_seconds);
      if (runtime == null) {
        runtime = 0;
      }
      totalruntime += runtime;
    }
    const wattage = (totalruntime / 3600) * 0.064;
    const kwh = parseFloat(wattage.toFixed(5));
    totalWattage += kwh;
    const usedTime = Math.floor(totalruntime / 3600);
    dataList.push({
      startDate: startdate,
      energyUsage: kwh,
      usedTime: usedTime,
    });
  }

  const totalCharge = totalWattage * usersResult.standard_rate;
  const averageWattage = parseFloat((totalWattage / 12).toFixed(5));
  const averageCharge = parseFloat((totalCharge / 12).toFixed(5));

  const returnList = {
    id: user_id.id,
    userId: usersResult.username,
    houseList: houseList,
    fanCount: usersResult.fan_count,
    standard_rate: usersResult.standard_rate,
    totalWattage: totalWattage,
    averageWattage: averageWattage,
    charges: new Intl.NumberFormat('en-US').format(totalCharge),
    averageCharge: new Intl.NumberFormat('en-US').format(averageCharge),
    dataList: dataList
  };

  console.log("returnList = ", returnList);
  return returnList;
}

// ✅ 4. 전체 일간 에너지통계 조회 (ceiling_fan)
export async function ceiling_totalDayEnergyInfo(info) {
  console.log(" ✅ 4. ceiling_fan 전체 일간 에너지통계 조회");
  const today = info.start_date;
  const dataList = [];

  // 1) 전체 사용자 정보 조회
  const usersSql =
    `SELECT 
        COUNT(DISTINCT u.id) AS total_users,
        COUNT(DISTINCT f.id) AS total_fans,
        AVG(u.standard_rate) AS avg_standard_rate
    FROM 
        user u
    LEFT JOIN 
        ceiling_house h ON h.user_id = u.id AND h.deleted_flag = 0
    LEFT JOIN 
        ceiling_gate g ON g.house_id = h.id
    LEFT JOIN 
        ceiling_fan f ON f.gate_id = g.id AND f.deleted_flag = 0
    WHERE 
        u.id IS NOT NULL;
    `;
  const usersResultArr = await AppDataSource3.query(usersSql);
  const usersResult = usersResultArr[0];

  // 2) 에너지 통계 조회 - 14일간의 일별 에너지 계산
  let totalWattage = 0;
  for (let i = 0; i < 14; i++) {
    const dateObj = subDays(today, i);
    const startdate = `${dateObj.toISOString().split('T')[0]} 00:00:00`;
    const end_date = `${dateObj.toISOString().split('T')[0]} 23:59:59`;

    const energyInfoSql =
      `WITH FanOnOffPairs AS (
        SELECT 
          fcl_on.fan_id,
          fcl_on.time_stamp AS fan_on_time,
          MIN(fcl_off.time_stamp) AS fan_off_time
        FROM 
          ceiling_fan_control_log fcl_on
        LEFT JOIN 
          ceiling_fan_control_log fcl_off
        ON 
          fcl_on.fan_id = fcl_off.fan_id
          AND fcl_off.command = 'fan-off'
          AND fcl_off.time_stamp > fcl_on.time_stamp
        WHERE 
          fcl_on.command = 'fan-on'
          AND fcl_on.time_stamp BETWEEN ? AND ?
        GROUP BY 
          fcl_on.fan_id, fcl_on.time_stamp
      ),
      Durations AS (
        SELECT 
          fan_id,
          TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
        FROM 
          FanOnOffPairs
        WHERE 
          fan_off_time IS NOT NULL 
      )
      SELECT 
        SUM(d.duration_seconds) AS total_runtime_seconds
      FROM 
        Durations d;`;
    const energyResult = await AppDataSource3.query(energyInfoSql, [startdate, end_date]);
    let totalruntime = 0;
    for (const data of energyResult) {
      let runtime = Number(data.total_runtime_seconds);
      if (runtime == null) {
        runtime = 0;
      }
      totalruntime += runtime;
    }
    const wattage = (totalruntime / 3600) * 0.064;
    const kwh = parseFloat(wattage.toFixed(5));
    totalWattage += kwh;
    const usedTime = Math.floor(totalruntime / 3600);
    dataList.push({
      startDate: startdate,
      energyUsage: kwh,
      usedTime: usedTime,
    });
  }

  const totalCharge = totalWattage * usersResult.avg_standard_rate;
  const averageWattage = parseFloat((totalWattage / 14).toFixed(5));
  const averageCharge = parseFloat((totalCharge / 14).toFixed(5));

  const returnList = {
    userCount: usersResult.total_users,
    fanCount: usersResult.total_fans,
    dataList: dataList,
    // avgStandardRate: usersResult.avg_standard_rate,
    totalWattage: totalWattage,
    averageWattage: averageWattage
    //charges: new Intl.NumberFormat('en-US').format(totalCharge),
    //averageCharge: new Intl.NumberFormat('en-US').format(averageCharge)
  };

  //console.log("returnList = ", returnList);
  return returnList;
}

// ✅ 5. 전체 주간 에너지통계 조회 (ceiling_fan)
export async function ceiling_totalWeekEnergyInfo(info) {
  console.log(" ✅ 5. ceiling_fan 전체 주간 에너지통계 조회");
  const date = info.start_week;
  const dataList = [];

  // 1) 전체 사용자 정보 조회
  const usersSql =
    `SELECT 
        COUNT(DISTINCT u.id) AS total_users,
        COUNT(DISTINCT f.id) AS total_fans,
        AVG(u.standard_rate) AS avg_standard_rate
    FROM 
        user u
    LEFT JOIN 
        ceiling_house h ON h.user_id = u.id AND h.deleted_flag = 0
    LEFT JOIN 
        ceiling_gate g ON g.house_id = h.id
    LEFT JOIN 
        ceiling_fan f ON f.gate_id = g.id AND f.deleted_flag = 0
    WHERE 
        u.id IS NOT NULL;
    `;
  const usersResultArr = await AppDataSource3.query(usersSql);
  const usersResult = usersResultArr[0];

  // 2) 에너지 통계 조회 - 14주간의 주별 에너지 계산
  let totalWattage = 0;
  for (let i = 0; i < 14; i++) {
    const pastDate = subWeeks(new Date(date), i);  // i주 전 날짜 계산
    // 해당 주의 시작과 종료 날짜 계산
    const startOfTheWeek = startOfWeek(pastDate, { weekStartsOn: 1 }); // 월요일 시작
    const endOfTheWeek = endOfWeek(pastDate, { weekStartsOn: 1 });
    // UTC 시간으로 변환
    const startOfTheWeekUTC = new Date(startOfTheWeek.getTime() - startOfTheWeek.getTimezoneOffset() * 60 * 1000);
    const endOfTheWeekUTC = new Date(endOfTheWeek.getTime() - endOfTheWeek.getTimezoneOffset() * 60 * 1000);

    console.log(`Week Query Range: ${startOfTheWeekUTC.toISOString()} - ${endOfTheWeekUTC.toISOString()}`);
    // 4) 해당 주의 팬 구동 시간 및 에너지 사용량 계산 ( 4번의 구동시간 쿼리 반복됨 )
  
    const energyInfoSql =
      `WITH FanOnOffPairs AS (
        SELECT 
          fcl_on.fan_id,
          fcl_on.time_stamp AS fan_on_time,
          MIN(fcl_off.time_stamp) AS fan_off_time
        FROM 
          ceiling_fan_control_log fcl_on
        LEFT JOIN 
          ceiling_fan_control_log fcl_off
        ON 
          fcl_on.fan_id = fcl_off.fan_id
          AND fcl_off.command = 'fan-off'
          AND fcl_off.time_stamp > fcl_on.time_stamp
        WHERE 
          fcl_on.command = 'fan-on'
          AND fcl_on.time_stamp BETWEEN ? AND ?
        GROUP BY 
          fcl_on.fan_id, fcl_on.time_stamp
      ),
      Durations AS (
        SELECT 
          fan_id,
          TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
        FROM 
          FanOnOffPairs
        WHERE 
          fan_off_time IS NOT NULL 
      )
      SELECT 
        SUM(d.duration_seconds) AS total_runtime_seconds
      FROM 
        Durations d;`;
    const energyResult = await AppDataSource3.query(energyInfoSql, [startOfTheWeekUTC, endOfTheWeekUTC]);
    
        // 5) 에너지 사용량 계산 
        let totalruntime = 0 // 해당 주의 모든팬의 총구동시간 계산 
        for (const data of energyResult) {
            let runtime = Number(data.total_runtime_seconds); // 팬 별 구동시간 계산 
            
            if ( runtime == null) {
                runtime = 0
            }
            totalruntime += runtime; // 해당 주의 모든팬의 총구동시간 계산 
        }

        console.log("그 주의 모든팬의 총구동시간 = ", totalruntime);
        // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
        const wattage = (totalruntime / 3600) * 0.064;
        const kwh = parseFloat(wattage.toFixed(5));
        totalWattage += kwh; // 총 에너지 사용량 계산 

        // 사용시간 (시간 단위)
        const usedTime = Math.floor(totalruntime/ 3600);

        // 데이터 리스트에 추가
        dataList.push({
            startDate: startOfTheWeekUTC.toISOString().split('T')[0],
            usedTime: usedTime,
            energyUsage: kwh
        });
    }

  const totalCharge = totalWattage * usersResult.avg_standard_rate;
  const averageWattage = parseFloat((totalWattage / 14).toFixed(5));
  const averageCharge = parseFloat((totalCharge / 14).toFixed(5));

  const returnList = {
    userCount: usersResult.total_users,
    fanCount: usersResult.total_fans,
    dataList: dataList,
    //avgStandardRate: usersResult.avg_standard_rate,
    totalWattage: parseFloat(totalWattage.toFixed(5)),
    averageWattage: averageWattage
    //charges: new Intl.NumberFormat('en-US').format(totalCharge),
    //averageCharge: new Intl.NumberFormat('en-US').format(averageCharge)
  };

  //console.log("returnList = ", returnList);
  return returnList;
}

// ✅ 6. 전체 월간 에너지통계 조회 (ceiling_fan)
export async function ceiling_totalMonthEnergyInfo(info) {
  console.log(" ✅ 6. ceiling_fan 전체 월간 에너지통계 조회");
  const date = info.start_month;
  const dataList = [];

  // 1) 전체 사용자 정보 조회
  const usersSql =
    `SELECT 
        COUNT(DISTINCT u.id) AS total_users,
        COUNT(DISTINCT f.id) AS total_fans,
        AVG(u.standard_rate) AS avg_standard_rate
    FROM 
        user u
    LEFT JOIN 
        ceiling_house h ON h.user_id = u.id AND h.deleted_flag = 0
    LEFT JOIN 
        ceiling_gate g ON g.house_id = h.id
    LEFT JOIN 
        ceiling_fan f ON f.gate_id = g.id AND f.deleted_flag = 0
    WHERE 
        u.id IS NOT NULL;
    `;
  const usersResultArr = await AppDataSource3.query(usersSql);
  const usersResult = usersResultArr[0];

  // 2) 에너지 통계 조회 - 12개월간의 월별 에너지 계산
  let totalWattage = 0;
  for (let i = 0; i < 12; i++) {
    const pastDate = subMonths(date, i);  // i개월 전 날짜 계산
    console.log("과거 월 = ", pastDate);
    const startOfTheMonth = startOfMonth(pastDate); // 해당 월의 첫째 날
    const nextStartOfTheMonth = addDays(startOfTheMonth, 1); //(1일을2일로 변경 monthEnergyInfo도 동일 날짜수때문일듯한데..)
    const RealStartOfTheMonth = nextStartOfTheMonth.toISOString().split('T')[0];
    const end = endOfMonth(pastDate); // 해당 월의 마지막 날
    const endOfTheMonth = end.toISOString().split('T')[0];
    
    const energyInfoSql =
      `WITH FanOnOffPairs AS (
        SELECT 
          fcl_on.fan_id,
          fcl_on.time_stamp AS fan_on_time,
          MIN(fcl_off.time_stamp) AS fan_off_time
        FROM 
          ceiling_fan_control_log fcl_on
        LEFT JOIN 
          ceiling_fan_control_log fcl_off
        ON 
          fcl_on.fan_id = fcl_off.fan_id
          AND fcl_off.command = 'fan-off'
          AND fcl_off.time_stamp > fcl_on.time_stamp
        WHERE 
          fcl_on.command = 'fan-on'
          AND fcl_on.time_stamp BETWEEN ? AND ?
        GROUP BY 
          fcl_on.fan_id, fcl_on.time_stamp
      ),
      Durations AS (
        SELECT 
          fan_id,
          TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
        FROM 
          FanOnOffPairs
        WHERE 
          fan_off_time IS NOT NULL 
      )
      SELECT 
        SUM(d.duration_seconds) AS total_runtime_seconds
      FROM 
        Durations d;`;
        
        const energyResult = await AppDataSource3.query(energyInfoSql, [RealStartOfTheMonth, endOfTheMonth]);
       
        // 5) 에너지 사용량 계산 
        let totalruntime = 0 // 해당 월의 모든팬의 총구동시간 계산 
        for (const data of energyResult) {
            let runtime = Number(data.total_runtime_seconds); // 팬 별 구동시간 계산 
            
            if ( runtime == null) {
                runtime = 0
            }
            totalruntime += runtime; // 해당 월의 모든팬의 총구동시간 계산 
        }
        
        // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
        const wattage = (totalruntime / 3600) * 0.064;
        const kwh = parseFloat(wattage.toFixed(5))
        totalWattage += kwh; // 총 에너지 사용량 계산 

        // 사용시간 (시간 단위)
        const usedTime = Math.floor(totalruntime / 3600)

        // 데이터 리스트에 추가
        dataList.push({
            startDate: RealStartOfTheMonth,
            usedTime: usedTime,
            energyUsage: kwh
        });
    }

  const totalCharge = totalWattage * usersResult.avg_standard_rate;
  const averageWattage = parseFloat((totalWattage / 12).toFixed(5));
  const averageCharge = parseFloat((totalCharge / 12).toFixed(5));

  const returnList = {
    userCount: usersResult.total_users,
    fanCount: usersResult.total_fans,
    dataList: dataList,
    //avgStandardRate: usersResult.avg_standard_rate,
    totalWattage: totalWattage,
    averageWattage: averageWattage
    //charges: new Intl.NumberFormat('en-US').format(totalCharge),
    //averageCharge: new Intl.NumberFormat('en-US').format(averageCharge)
  };

  //console.log("returnList = ", returnList);
  return returnList;
}

// ✅ 7. 하우스별 일간 에너지통계 조회 (ceiling_fan)
export async function ceiling_houseDayEnergyInfo(info) {
  console.log(" ✅ 7. ceiling_fan 하우스별 일간 에너지통계 조회");
  
  // 1) 날짜 정보 조회
  const today = info.start_date;
  const dataList = [];

  // 2) 사용자 정보 조회 
  const user_id = await userRepository3.findOne({where : [{ username: info.userId } , { name: info.userId }]});
  
  if( !user_id ){
    //console.log("없는 사용자 입니다.");
    return { message : "없는 사용자 입니다."};
  }

  const userSql = `
            SELECT 
                u.id, 
                u.username, 
                u.name, 
                u.standard_rate, 
                COUNT(CASE WHEN f.deleted_flag = 0 THEN f.id END) AS fanCount
            FROM 
                user u
            LEFT JOIN 
                ceiling_house h ON u.id = h.user_id
            LEFT JOIN 
                ceiling_gate g ON h.id = g.house_id
            LEFT JOIN 
                ceiling_fan f ON g.id = f.gate_id
            WHERE
                u.id = ?
            GROUP BY 
                u.id;
            `;
        
  const usersResultArr = await AppDataSource3.query(userSql, [user_id.id]);
  const usersResult = usersResultArr[0];

  // 2) 전체 하우스 리스트 조회 (해당 유저의 모든 하우스)
  const houseListSql = `
                SELECT 
                    h.id AS house_id, 
                    h.name AS house_name, 
                    h.\`order\` AS house_order, 
                    COUNT(DISTINCT f.id) AS fan_count 
                FROM 
                    ceiling_house h 
                LEFT JOIN 
                    ceiling_gate g ON g.house_id = h.id 
                LEFT JOIN 
                    ceiling_fan f ON f.gate_id = g.id AND f.deleted_flag = 0
                WHERE 
                    h.user_id = ? 
                    AND h.deleted_flag = 0 
                GROUP BY 
                    h.id, h.name, h.\`order\`
                ORDER BY 
                    h.\`order\` ASC;
                `;

        
  const houseList = (await AppDataSource3.query(houseListSql, [usersResult.id])).map(house => ({
    id: house.house_id,
    name: house.house_name,
    houseOrderNum: house.house_order,
    getFanNum: house.fan_count
  }));

  // 3) 에너지 통계 조회 - 14일간의 일별 에너지 계산
  let totalWattage = 0;
  for (let i = 0; i < 14; i++) {
    const dateObj = subDays(today, i);
    const startdate = `${dateObj.toISOString().split('T')[0]} 00:00:00`;
    const end_date = `${dateObj.toISOString().split('T')[0]} 23:59:59`;
    const energyInfoSql =
      `WITH FanOnOffPairs AS (
            SELECT 
            fcl_on.fan_id,
            fcl_on.time_stamp AS fan_on_time,
            MIN(fcl_off.time_stamp) AS fan_off_time
            FROM 
            ceiling_fan_control_log fcl_on
            LEFT JOIN 
            ceiling_fan_control_log fcl_off
            ON 
            fcl_on.fan_id = fcl_off.fan_id
            AND fcl_off.command = 'fan-off'
            AND fcl_off.time_stamp > fcl_on.time_stamp
            WHERE 
            fcl_on.command = 'fan-on'
            AND fcl_on.time_stamp BETWEEN ? AND ?
            GROUP BY 
            fcl_on.fan_id, fcl_on.time_stamp
        ),
        Durations AS (
            SELECT 
            fan_id,
            TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
            FROM 
            FanOnOffPairs
            WHERE 
            fan_off_time IS NOT NULL 
        )
        SELECT 
            SUM(d.duration_seconds) AS total_runtime_seconds
        FROM 
            Durations d
        JOIN 
            ceiling_fan f ON d.fan_id = f.id
        JOIN 
            ceiling_gate g ON f.gate_id = g.id
        JOIN 
            ceiling_house h ON g.house_id = h.id
        WHERE 
            h.id = ?;
    `;

    const energyResult = await AppDataSource3.query(energyInfoSql, [startdate, end_date, info.houseId]);
    let totalruntime = 0;
    for (const data of energyResult) {
      let runtime = Number(data.total_runtime_seconds);
      if (runtime == null) {
        runtime = 0;
      }
      totalruntime += runtime;
    }
    const wattage = (totalruntime / 3600) * 0.064;
    const kwh = parseFloat(wattage.toFixed(5));
    totalWattage += kwh;
    const usedTime = Math.floor(totalruntime / 3600);
    dataList.push({
      startDate: startdate,
      energyUsage: kwh,
      usedTime: usedTime,
    });
  }

  const totalCharge = totalWattage * usersResult.standard_rate;
  const averageWattage = parseFloat((totalWattage / 14).toFixed(5));
  const averageCharge = parseFloat((totalCharge / 14).toFixed(5));

  const returnList = {
    id: usersResult.id,
    userId: usersResult.username,
    //userName: usersResult.name,
    houseList: houseList,
    fanCount: usersResult.fanCount,
    standard_rate: usersResult.standard_rate,
    totalWattage: totalWattage,
    averageWattage: averageWattage,
    charges: new Intl.NumberFormat('en-US').format(totalCharge),
    averageCharge: new Intl.NumberFormat('en-US').format(averageCharge),
    dataList: dataList
  };

  console.log("returnList = ", returnList);
  return returnList;
}

// ✅ 8. 하우스별 주간 에너지통계 조회 (ceiling_fan)
export async function ceiling_houseWeekEnergyInfo(info) {   
  console.log(" ✅ 8. ceiling_fan 하우스별 주간 에너지통계 조회");          

  // 1) 날짜 정보 조회  
  const date = info.start_week;
  const dataList = [];
  // 2) 사용자 정보 조회 
  const user_id = await userRepository3.findOne({where : [{ username: info.userId } , { name: info.userId }]});
    
  if( !user_id ){
    //console.log("없는 사용자 입니다.");
    return { message : "없는 사용자 입니다."};
  }

  const userSql = `
            SELECT 
                u.id, 
                u.username, 
                u.name, 
                u.standard_rate, 
                COUNT(CASE WHEN f.deleted_flag = 0 THEN f.id END) AS fanCount
            FROM 
                user u
            LEFT JOIN 
                ceiling_house h ON u.id = h.user_id
            LEFT JOIN 
                ceiling_gate g ON h.id = g.house_id
            LEFT JOIN 
                ceiling_fan f ON g.id = f.gate_id
            WHERE
                u.id = ?
            GROUP BY 
                u.id;
            `;
        
  const usersResultArr = await AppDataSource3.query(userSql, [user_id.id]);
  const usersResult = usersResultArr[0];

  // 2) 전체 하우스 리스트 조회 (해당 유저의 모든 하우스)
  const houseListSql = `
            SELECT 
                h.id AS house_id, 
                h.name AS house_name, 
                h.\`order\` AS house_order, 
                COUNT(DISTINCT f.id) AS fan_count 
            FROM 
                ceiling_house h 
            LEFT JOIN 
                ceiling_gate g ON g.house_id = h.id 
            LEFT JOIN 
                ceiling_fan f ON f.gate_id = g.id AND f.deleted_flag = 0
            WHERE 
                h.user_id = ? 
                AND h.deleted_flag = 0 
            GROUP BY 
                h.id, h.name, h.\`order\`
            ORDER BY 
                h.\`order\` ASC;
            `;
        
  const houseList = (await AppDataSource3.query(houseListSql, [usersResult.id])).map(house => ({
    id: house.house_id,
    name: house.house_name,
    houseOrderNum: house.house_order,
    getFanNum: house.fan_count
  }));

  // 4) 에너지 통계 조회 - 14주간의 주별 에너지 계산
  let totalWattage = 0;
  for (let i = 0; i < 14; i++) {
    const pastDate = subWeeks(new Date(date), i); // i주 전 날짜 계산
    console.log("과거 일 = ", pastDate);
    const startOfTheWeek = startOfWeek(pastDate, { weekStartsOn: 1 }); // 월요일 시작
    const endOfTheWeek = endOfWeek(pastDate, { weekStartsOn: 1 });
    const startOfTheWeekUTC = new Date(startOfTheWeek.getTime() - startOfTheWeek.getTimezoneOffset() * 60 * 1000);
    const endOfTheWeekUTC = new Date(endOfTheWeek.getTime() - endOfTheWeek.getTimezoneOffset() * 60 * 1000);

    const energyInfoSql =
      `WITH FanOnOffPairs AS (
            SELECT 
            fcl_on.fan_id,
            fcl_on.time_stamp AS fan_on_time,
            MIN(fcl_off.time_stamp) AS fan_off_time
            FROM 
            ceiling_fan_control_log fcl_on
            LEFT JOIN 
            ceiling_fan_control_log fcl_off
            ON 
            fcl_on.fan_id = fcl_off.fan_id
            AND fcl_off.command = 'fan-off'
            AND fcl_off.time_stamp > fcl_on.time_stamp
            WHERE 
            fcl_on.command = 'fan-on'
            AND fcl_on.time_stamp BETWEEN ? AND ?
            GROUP BY 
            fcl_on.fan_id, fcl_on.time_stamp
        ),
        Durations AS (
            SELECT 
            fan_id,
            TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
            FROM 
            FanOnOffPairs
            WHERE 
            fan_off_time IS NOT NULL 
        )
        SELECT 
            SUM(d.duration_seconds) AS total_runtime_seconds
        FROM 
            Durations d
        JOIN 
            ceiling_fan f ON d.fan_id = f.id
        JOIN 
            ceiling_gate g ON f.gate_id = g.id
        JOIN 
            ceiling_house h ON g.house_id = h.id
        WHERE 
            h.id = ?;
        `;
        
    //const energyResult = await AppDataSource3.query(energyInfoSql, [startdate, end_date, info.houseId]);

    const energyResult = await AppDataSource3.query(energyInfoSql, [startOfTheWeekUTC, endOfTheWeekUTC, info.houseId]);
    //console.log("energyResult = ", energyResult);
    // 5) 에너지 사용량 계산 
    let totalruntime = 0 // 해당 주의 모든팬의 총구동시간 계산 
    let runtime = 0
    for (const data of energyResult) {
        runtime = Number(data.total_runtime_seconds); // 팬 별 구동시간 계산 
        
        if ( runtime == null) {
            runtime = 0
        }
        totalruntime += runtime; // 해당 주의 모든팬의 총구동시간 계산 
    }

    // kWh 계산 (0.064kW = 팬 1대당 전력소비량)
    const wattage = (totalruntime / 3600) * 0.064;
    const kwh = parseFloat(wattage.toFixed(5))
    totalWattage += kwh; // 총 에너지 사용량 계산 

    // 사용시간 (시간 단위)
    const usedTime = Math.floor(totalruntime/ 3600);
    
    console.log("그주의 모든팬의 총구동시간 = ", totalruntime);
    // 데이터 리스트에 추가
    dataList.push({
        startDate: startOfTheWeekUTC.toISOString().split('T')[0],
        energyUsage: kwh,
        usedTime: usedTime
    });
}


  const totalCharge = totalWattage * usersResult.standard_rate;
  const averageWattage = parseFloat((totalWattage / 14).toFixed(5));
  const averageCharge = parseFloat((totalCharge / 14).toFixed(5));

  const returnList = {
    id: usersResult.id,
    userId: usersResult.username,
   //userName: usersResult.name,
    houseList: houseList,
    fanCount: usersResult.fanCount,
    standard_rate: usersResult.standard_rate,
    totalWattage: totalWattage,
    averageWattage: averageWattage,
    charges: new Intl.NumberFormat('en-US').format(totalCharge),
    averageCharge: new Intl.NumberFormat('en-US').format(averageCharge),
    dataList: dataList
  };

  console.log("returnList = ", returnList);
  return returnList;
}

// ✅ 9. 하우스별 월간 에너지통계 조회 (ceiling_fan)
export async function ceiling_houseMonthEnergyInfo(info) {
  console.log(" ✅ 9. ceiling_fan 하우스별 월간 에너지통계 조회");

  // 1) 날짜 정보 조회      
  const date = info.start_month;
  const dataList = [];
  // 2) 사용자 정보 조회 
  const user_id = await userRepository3.findOne({where : [{ username: info.userId } , { name: info.userId }]});

  if( !user_id ){
    //console.log("없는 사용자 입니다.");
    return { message : "없는 사용자 입니다."};
  }

  const userSql = `
            SELECT 
                u.id, 
                u.username, 
                u.name, 
                u.standard_rate, 
                COUNT(CASE WHEN f.deleted_flag = 0 THEN f.id END) AS fanCount
            FROM 
                user u
            LEFT JOIN 
                ceiling_house h ON u.id = h.user_id
            LEFT JOIN 
                ceiling_gate g ON h.id = g.house_id
            LEFT JOIN 
                ceiling_fan f ON g.id = f.gate_id
            WHERE
                u.id = ?
            GROUP BY 
                u.id;
            `;
        
  const usersResultArr = await AppDataSource3.query(userSql, [user_id.id]);
  const usersResult = usersResultArr[0];

  // 3) 전체 하우스 리스트 조회 (해당 유저의 모든 하우스)
  const houseListSql = `
                SELECT 
                    h.id AS house_id, 
                    h.name AS house_name, 
                    h.\`order\` AS house_order, 
                    COUNT(DISTINCT f.id) AS fan_count 
                FROM 
                    ceiling_house h 
                LEFT JOIN 
                    ceiling_gate g ON g.house_id = h.id 
                LEFT JOIN 
                    ceiling_fan f ON f.gate_id = g.id AND f.deleted_flag = 0
                WHERE 
                    h.user_id = ? 
                    AND h.deleted_flag = 0 
                GROUP BY 
                    h.id, h.name, h.\`order\`
                ORDER BY 
                    h.\`order\` ASC;
                `;
        
  const houseList = (await AppDataSource3.query(houseListSql, [usersResult.id])).map(house => ({
    id: house.house_id,
    name: house.house_name,
    houseOrderNum: house.house_order,
    getFanNum: house.fan_count
  }));

  // 4) 에너지 통계 조회 - 12개월간의 월별 에너지 계산
  let totalWattage = 0;
  for (let i = 0; i < 12; i++) {
    const pastDate = subMonths(date, i);  // i개월 전 날짜 계산
    const startOfTheMonth = startOfMonth(pastDate); // 해당 월의 첫째 날
    const nextStartOfTheMonth = addDays(startOfTheMonth, 1);
    const RealStartOfTheMonth = nextStartOfTheMonth.toISOString().split('T')[0];

    const end = endOfMonth(pastDate); // 해당 월의 마지막 날
    const endOfTheMonth = end.toISOString().split('T')[0];
    const energyInfoSql =
      `WITH FanOnOffPairs AS (
            SELECT 
            fcl_on.fan_id,
            fcl_on.time_stamp AS fan_on_time,
            MIN(fcl_off.time_stamp) AS fan_off_time
            FROM 
            ceiling_fan_control_log fcl_on
            LEFT JOIN 
            ceiling_fan_control_log fcl_off
            ON 
            fcl_on.fan_id = fcl_off.fan_id
            AND fcl_off.command = 'fan-off'
            AND fcl_off.time_stamp > fcl_on.time_stamp
            WHERE 
            fcl_on.command = 'fan-on'
            AND fcl_on.time_stamp BETWEEN ? AND ?
            GROUP BY 
            fcl_on.fan_id, fcl_on.time_stamp
        ),
        Durations AS (
            SELECT 
            fan_id,
            TIMESTAMPDIFF(SECOND, fan_on_time, fan_off_time) AS duration_seconds
            FROM 
            FanOnOffPairs
            WHERE 
            fan_off_time IS NOT NULL 
        )
        SELECT 
            SUM(d.duration_seconds) AS total_runtime_seconds
        FROM 
            Durations d
        JOIN 
            ceiling_fan f ON d.fan_id = f.id
        JOIN 
            ceiling_gate g ON f.gate_id = g.id
        JOIN 
            ceiling_house h ON g.house_id = h.id
        WHERE 
            h.id = ?;
    `;

    const energyResult = await AppDataSource3.query(energyInfoSql, [RealStartOfTheMonth, endOfTheMonth, info.houseId]);

    let totalruntime = 0;
    for (const data of energyResult) {
      let runtime = Number(data.total_runtime_seconds);
      if (runtime == null) {
        runtime = 0;
      }
      totalruntime += runtime;
    }
    const wattage = (totalruntime / 3600) * 0.064;
    const kwh = parseFloat(wattage.toFixed(5));
    totalWattage += kwh;
    const usedTime = Math.floor(totalruntime / 3600);
    dataList.push({
        startDate: RealStartOfTheMonth,
        usedTime: usedTime,
        energyUsage: kwh
    });
  }

  const totalCharge = totalWattage * usersResult.standard_rate;
  const averageWattage = parseFloat((totalWattage / 12).toFixed(5));
  const averageCharge = parseFloat((totalCharge / 12).toFixed(5));

  const returnList = {
    id: usersResult.id,
    userId: usersResult.username,
    //userName: usersResult.name,
    houseList: houseList,
    fanCount: usersResult.fanCount,
    standard_rate: usersResult.standard_rate,
    totalWattage: totalWattage,
    averageWattage: averageWattage,
    charges: new Intl.NumberFormat('en-US').format(totalCharge),
    averageCharge: new Intl.NumberFormat('en-US').format(averageCharge),
    dataList: dataList
  };

  console.log("returnList = ", returnList);
  return returnList;
}

// ========================================
// 📊 관리자 페이지 - 공지사항
// ========================================

// 공지사항 목록 조회(전체 목록 + 제목 )
export async function getNoticeList(title) {
    try {
      const noticeRepo = AppDataSource3.getRepository(Notice);
  
      let qb = noticeRepo
        .createQueryBuilder("notice")
        .leftJoin("admin", "admin", "notice.user_id = admin.admin_id")
        .leftJoin("user", "user", "notice.user_id = user.username")
        .select([
          "notice.id AS id",
          "notice.title AS title",
          "notice.created_at AS created_at",
          `CASE 
            WHEN admin.name IS NOT NULL THEN admin.name
            ELSE user.name
          END AS created_by`
        ])
        .orderBy("notice.created_at", "DESC");
  
      if (title) {
        qb = qb.where("notice.title LIKE :title", { title: `%${title}%` });
      }
  
      const notices = await qb.getRawMany();
  
      if (!notices.length) {
        return { message: "공지사항이 없습니다." };
      }
  
      let no = notices.length;
      return notices.map(row => {
        let noRow = { no: no-- };
        return { ...noRow, ...row };
      });
  
    } catch (err) {
      console.error("공지사항 목록 조회 repository 오류:", err);
      throw err;
    }
}
  

// 공지사항 상세
// 공지사항 상세
export async function getNoticeDetail(id) {
    try {
      const noticeRepo = AppDataSource3.getRepository(Notice);
  
      const notice = await noticeRepo
        .createQueryBuilder("notice")
        .leftJoin("admin", "admin", "notice.user_id = admin.admin_id")
        .leftJoin("user", "user", "notice.user_id = user.username")
        .select([
          "notice.id AS id",
          "notice.title AS title",
          "notice.content AS content",
          "notice.created_at AS created_at",
          `CASE 
            WHEN admin.name IS NOT NULL THEN admin.name
            ELSE user.name
          END AS created_by`
        ])
        .where("notice.id = :id", { id: parseInt(id) })
        .getRawOne();
  
      return notice || { message: "공지사항이 없습니다." };
    } catch (err) {
      console.error("공지사항 상세 조회 repository 오류:", err);
      throw err;
    }
}
  

// 공지사항 작성
export async function createNotice(user_id, title, content) {
  try {
    const noticeRepo = AppDataSource3.getRepository(Notice);
    const newNotice = noticeRepo.create({ user_id, title, content });

    const savedNotice = await noticeRepo.save(newNotice);

    return { insertId: savedNotice.id };
  } catch (err) {
    console.error("공지사항 작성 repository 오류:", err);
    throw err;
  }
}

// 공지사항 수정
export async function updateNotice(id, { title, content }) {
  try {
    const noticeRepo = AppDataSource3.getRepository(Notice);
    const updateData = { updated_at: new Date() };
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;

    if (Object.keys(updateData).length === 1) {
      // updated_at 제외하고 수정할 데이터가 없을 경우
      throw new Error("수정할 데이터가 없습니다.");
    }

    await noticeRepo.update({ id: parseInt(id) }, updateData);
    return { success: true };
  } catch (err) {
    console.error("공지사항 수정 repository 오류:", err);
    throw err;
  }
}

// 공지사항 삭제
export async function removeNotice(id) {
  try {
    const noticeRepo = AppDataSource3.getRepository(Notice);
    await noticeRepo.delete({ id: parseInt(id) });
    return { success: true };
  } catch (err) {
    console.error("공지사항 삭제 repository 오류:", err);
    throw err;
  }
}

