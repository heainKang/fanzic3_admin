import express from 'express';
import * as adminController from "../controller/adminController.js";

const router = express.Router();
// 25.07 새로운 =================================================================
// 관리자 정보
router.post('/register', adminController.registerAdmin);
router.post('/login', adminController.login);
router.post('/modifyPassword/:adminId', adminController.modifyAdminPassword); // 관리자 비밀번호 변경


// 사용자정보
router.get('/usersInfo/:page/:limit', adminController.allUserInfo);       // ✅ 사용자정보 - 1. 정보 조회 (전체 + 유저별 + 팬별)
router.get('/fanDetail/:userId', adminController.fanDetail);              // ✅ 사용자정보 - 2. 유저별 팬 상세 조회
router.get('/userDetail/:userId', adminController.userDetail);            // ✅ 사용자정보 - 3. 유저별 회원정보 조회
router.patch('/modifyUser/:userId', adminController.modifyUser);          // ✅ 사용자정보 - 4. 유저별 회원정보 수정
router.delete('/deleteUser/:userId', adminController.deleteUser);         // ✅ 사용자정보 - 5. 유저별 회원정보 삭제
router.post('/resetPassword/:userId', adminController.resetUserPassword); // ✅ 사용자정보 - 6. 유저별 회원 비밀번호 초기화

// 팬정보
router.get('/fanDetailInfo/:page/:limit', adminController.fanDetailInfo);                   // ✅ 팬정보 - 1. 팬 정보 조회(유저별/타입별/팬별)
router.get('/usedTime/:fan_id/:fan_type/:start_month', adminController.usedTime);           // ✅ 팬정보 - 2. 팬 사용시간 조회
router.get('/eventLog/:fan_id/:fan_type/:start_month', adminController.eventLog);           // ✅ 팬정보 - 3. 팬 이벤트 로그 조회
router.delete('/deleteFan/:fan_type/:fan_id', adminController.deleteFan);                   // ✅ 팬정보 - 4. 팬 삭제
router.get('/fanDetailModal/:fan_type/:fan_id', adminController.fanDetailModal);            // ✅ 팬정보 - 5. 팬 수정모달창 조회
router.patch('/modifyFanDetail/:fan_type/:fan_id', adminController.modifyFanDetail);        // ✅ 팬정보 - 6. 팬 수정모달창 수정
router.get('/totalUsedTime/:fan_type/:fan_id', adminController.totalUsedTime);              // ✅ 팬정보 - 7. 팬  사용시간 조회 (파람없을때 분기 (?)) //
/*
router.get('/fanDetailModal/:fan_type/:fan_id', (req, res, next) => {
    console.log("🔥 라우터 타는지 확인", req.params);
    next();
  }, adminController.fanDetailModal);
*/
// 팬상태데이터 삭제
router.post('/deleteFanStatus', adminController.deleteFanStatus); // 팬상태데이터 삭제 (화면 어디인지 확인필요)

// 통계(대시보드) 유동팬
router.get('/dayEnergyInfo/:userId/:start_date', adminController.dayEnergyInfo);        // ✅ 1. 유동팬 유저별 일간 에너지통계 조회 
router.get('/weekEnergyInfo/:userId/:start_week', adminController.weekEnergyInfo);      // ✅ 2. 유동팬 유저별 주간 에너지통계 조회
router.get('/monthEnergyInfo/:userId/:start_month', adminController.monthEnergyInfo);   // ✅ 3. 유동팬 유저별 월간 에너지통계 조회
router.get('/totalDayEnergyInfo/:start_date', adminController.totalDayEnergyInfo);      // ✅ 4. 유동팬 전체 일간 에너지통계 조회
router.get('/totalWeekEnergyInfo/:start_week', adminController.totalWeekEnergyInfo);    // ✅ 5. 유동팬 전체 주간 에너지통계 조회
router.get('/totalMonthEnergyInfo/:start_month', adminController.totalMonthEnergyInfo); // ✅ 6. 유동팬 전체 월간 에너지통계 조회

// 작업장별 전기요금 유동팬
router.get('/houseDayEnergyInfo/:userId/:houseId/:start_date', adminController.houseDayEnergyInfo);         // ✅ 7. 유동팬 하우스별 일간 에너지통계 조회
router.get('/houseWeekEnergyInfo/:userId/:houseId/:start_week', adminController.houseWeekEnergyInfo);       // ✅ 8. 유동팬 하우스별 주간 에너지통계 조회    
router.get('/houseMonthEnergyInfo/:userId/:houseId/:start_month', adminController.houseMonthEnergyInfo);    // ✅ 9. 유동팬 하우스별 월간 에너지통계 조회

// 통계(대시보드) 실링팬
router.get('/ceiling_dayEnergyInfo/:userId/:start_date', adminController.ceiling_dayEnergyInfo);        // ✅ 1. 실링팬 유저별 일간 에너지통계 조회 
router.get('/ceiling_weekEnergyInfo/:userId/:start_week', adminController.ceiling_weekEnergyInfo);      // ✅ 2. 실링팬 유저별 주간 에너지통계 조회
router.get('/ceiling_monthEnergyInfo/:userId/:start_month', adminController.ceiling_monthEnergyInfo);   // ✅ 3. 실링팬 유저별 월간 에너지통계 조회
router.get('/ceiling_totalDayEnergyInfo/:start_date', adminController.ceiling_totalDayEnergyInfo);      // ✅ 4. 실링팬 전체 일간 에너지통계 조회
router.get('/ceiling_totalWeekEnergyInfo/:start_week', adminController.ceiling_totalWeekEnergyInfo);    // ✅ 5. 실링팬 전체 주간 에너지통계 조회
router.get('/ceiling_totalMonthEnergyInfo/:start_month', adminController.ceiling_totalMonthEnergyInfo); // ✅ 6. 실링팬 전체 월간 에너지통계 조회

 //작업장별 전기요금 실링팬
router.get('/ceiling_houseDayEnergyInfo/:userId/:houseId/:start_date', adminController.ceiling_houseDayEnergyInfo);         // ✅ 7. 실링팬 하우스별 일간 에너지통계 조회
router.get('/ceiling_houseWeekEnergyInfo/:userId/:houseId/:start_week', adminController.ceiling_houseWeekEnergyInfo);       // ✅ 8. 실링팬 하우스별 주간 에너지통계 조회    
router.get('/ceiling_houseMonthEnergyInfo/:userId/:houseId/:start_month', adminController.ceiling_houseMonthEnergyInfo);    // ✅ 9. 실링팬 하우스별 월간 에너지통계 조회

// 공지사항
router.get('/notice', adminController.noticeList);           // 목록 + 제목검색
router.get('/notice/:id', adminController.noticeDetail);     // 상세조회
router.post('/notice', adminController.noticeCreate);        // 작성
router.patch('/notice/:id', adminController.noticeUpdate);   // 수정
router.delete('/notice/:id', adminController.noticeRemove);  // 삭제

export default router;

