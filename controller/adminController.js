import * as adminRepository from '../repository/adminRepository.js';

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// 관리자 등록
export async function registerAdmin(req, res) {
    try {
        console.log("관리자 등록");
        const info = req.body;
        console.log(info);
        const result = await adminRepository.registerAdmin(info);

        console.log(result);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
}

// 관리자 로그인
export async function login(req, res) {
    try {
        // Admin 계정에 입력된 id가 있는지 확인.(개수가 1이상인지 확인)
        const info = req.body;
        console.log("로그인 요청 값 =", info);
        const result = await adminRepository.login(info);
        console.log("로그인함수 실행 유저 = ", result);
        result.login = false;
        let token = null; 
        if (result.cnt === 1) {
            const inputpassword = bcrypt.hashSync(info.password, 10);
            console.log("inputpassword = ", inputpassword);
            console.log("result.password = ", result.password);
            if (bcrypt.compareSync(info.password, result.password)) {
                console.log("비번확인성공")
                result.login = true;
                token = jwt.sign({ id: req.body.id, id_idx: result.id , authority: result.authority}, '556pT=W6Pr')
                result.token = token;
                return res.status(200).json({ message: "로그인 성공", 응답상태: 200, userIdx : result.id});
            } else {
                return res.status(200).json({ message: "아이디 또는 비밀번호가 잘못되었습니다." });
            }
        } else {
            return res.status(200).json({ message: "등록된 아이디가 아닙니다." });
        }
    } catch (error) {
        console.error("로그인 에러:", error);
        return res.status(500).json({ message: "서버 에러" });
    }
}

// 관리자 비밀번호 변경
export async function modifyAdminPassword(req, res) {
    try {
        console.log("관리자 비밀번호 변경");
        const admin_id = req.params.adminId;
        console.log(admin_id);
        const info = req.body;
        const result = await adminRepository.modifyAdminPassword(admin_id, info);
        res.json(result);
    } catch (error) {
        console.error("error : ", error);
        return res.status(500).json({ message: "서버 에러" });
    }
}

// ========================================
// 📊 관리자 - 사용자정보
// ========================================

// ✅ 사용자정보 - 1. 정보 조회 (전체 + 유저별 + 팬별)
export async function allUserInfo(req, res) {
    //console.log("요청 들어옴: allUserInfo");

    const page = parseInt(req.params.page) || 1;
    const limit = parseInt(req.params.limit) || 10;
    const userId = req.query.userId || "";
    //const fan_id = req.query.fan_id || "";

    //const { userId, fan_id } = req.query;

    try {
        const data = await adminRepository.allUserInfo({ userId, page, limit });
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "사용자정보 조회 오류" });
    }
}

// ✅ 사용자정보 - 2. 유저별 팬 상세 조회
export async function fanDetail(req, res) {
    try {
        //console.log("유저별 팬 정보 조회");
        //console.log(req.params.userId);
        if (!req.params.userId) {
            return res.status(400).json({ message: "userId 파라미터가 필요합니다." });
        }
        const info = req.params;
        const result = await adminRepository.fanDetail(info);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "유저별 팬 상세 조회 오류" });
    }
}

// ✅ 사용자정보 - 3. 유저별 회원정보 조회
export async function userDetail(req, res) {
    try {
        //console.log("유저별 상세 정보 조회");
        const user_id = req.params.userId; 
        if (!user_id) {
            return res.status(400).json({ message: "userId 파라미터가 필요합니다." });
        }
        const result = await adminRepository.userDetail({userId: user_id});
        res.json(result);
    } catch (error) {
        console.log(error);
    }
}

// ✅ 사용자정보 - 4. 유저별 회원정보 수정
export async function modifyUser(req, res) {
    //console.log("요청 들어옴: modifyUser", req.params.userId, req.body);

    try {
        if (!req.params.userId) {
            return res.status(400).json({ message: "userId 파라미터가 필요합니다." });
        }

        const result = await adminRepository.modifyUser({
            userId: req.params.userId,
            updateData: req.body
        });
        
        //res.json({ success: true, result });
        res.json({ message: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "유저별 회원정보 수정 오류" });
    }
}

// ✅ 사용자정보 - 5. 유저별 회원정보 삭제
export async function deleteUser(req, res) {
    try {
        // console.log("유저 정보 삭제");
        const user_id = req.params.userId;
        const result = await adminRepository.deleteUser(user_id);
        res.json({ message: result });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "유저별 회원정보 삭제 오류" });
    }
} 

// ✅ 사용자정보 - 6. 유저별 회원 비밀번호 초기화
export async function resetUserPassword(req, res) {
    try {
        //console.log("사용자 비밀번호 초기화");
        const user_id = req.params.userId;
        const result = await adminRepository.resetUserPassword(user_id);
        res.json(result);
    } catch (error) {
        console.error("error : ", error);
        return res.status(500).json({ message: "유저별 회원 비밀번호 초기화 오류" });
    }
}

// ========================================
// 📊 관리자 통계 페이지 - 유동 개별 사용자 통계
// ========================================

// 일별 에너지 통계 조회 (개별 사용자)
export async function dayEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 일별 에너지통계 조회");
        const info = req.params;
        const result = await adminRepository.dayEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
}

// 하우스 일별 에너지 통계 조회 (개별 사용자)
export async function houseDayEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 하우스별 일별 에너지통계 조회");
        const info = req.params;
        const result = await adminRepository.houseDayEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
}

// 주별 에너지 통계 조회 (개별 사용자)
export async function weekEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 주별 에너지통계 조회");
        const info = req.params;   
        //console.log("info = ", info);
        const result = await adminRepository.weekEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
}

// 하우스 주별 에너지 통계 조회 (개별 사용자)
export async function houseWeekEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 하우스별 주별 에너지통계 조회");
        const info = req.params;   
        //console.log(info);
        const result = await adminRepository.houseWeekEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
}

// 월별 에너지 통계 조회 (개별 사용자)
export async function monthEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 월별 에너지통계 조회");
        const info = req.params;  
        //console.log(info);
        const result = await adminRepository.monthEnergyInfo(info);
        //console.log("월별 result=", result);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
}

// 하우스별 월별 에너지 통계 조회 (개별 사용자)
export async function houseMonthEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 하우스별 월별 에너지통계 조회");
        const info = req.params;  
        //console.log(info);
        const result = await adminRepository.houseMonthEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
}

// ========================================
// 🌐 관리자 통계 페이지 - 유동 전체 시스템 통계
// ========================================

// 전체 일별 에너지 통계 조회 (시스템 전체)
export async function totalDayEnergyInfo(req, res) {
    try {
        //console.log("🌐 [시스템 전체] 일별 에너지통계 조회");
        const info = req.params;
        const result = await adminRepository.totalDayEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
}

// 전체 주별 에너지 통계 조회 (시스템 전체)
export async function totalWeekEnergyInfo(req, res) {
    try {
        //console.log("🌐 [시스템 전체] 주별 에너지통계 조회");
        const info = req.params;   
        //console.log(info);
        const result = await adminRepository.totalWeekEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
}

// 전체 월별 에너지 통계 조회 (시스템 전체)
export async function totalMonthEnergyInfo(req, res) {
    try {
        //console.log("🌐 [시스템 전체] 월별 에너지통계 조회");
        const info = req.params;  
        //console.log(info);
        const result = await adminRepository.totalMonthEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
}

// ========================================
// 📊 관리자 - 팬정보
// ========================================

// ✅ 팬정보 - 1. 팬 정보 조회(유저별/타입별/팬별)
export async function fanDetailInfo(req, res) {
    try {
        //console.log("✅ 팬 상세 정보 컨트롤러 요청 들어옴 (params + query)");

        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(req.params.limit) || 10;
        const userId = req.query.userId || "";
        const fan_type = req.query.fan_type || "";
        const fan_id = req.query.fan_id || "";

        const result = await adminRepository.fanDetailInfo({ userId, fan_type, fan_id, page, limit });
        res.json(result);
    } catch (err) {
        console.error("팬 상세 정보 에러:", err);
        res.status(500).json({ message: "팬 상세 정보 조회 오류" });
    }
}

//  ✅ 팬정보 - 2. 팬 사용시간 조회
export async function usedTime(req, res) {
    try {
        //console.log("팬 사용시간 이력");
        //console.log(req.params);
        
        const fan_id = req.params.fan_id;
        const fan_type = req.params.fan_type;
        const start_month = new Date(req.params.start_month);
        
        if (!fan_id || !fan_type || !start_month) {
            return res.status(400).json({ message: "fan_id, fan_type, start_month 필수 파라미터 누락" });
        }
        

        const result = await adminRepository.usedTime(fan_id, fan_type, start_month);
        res.json(result);
        
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "팬 사용시간 조회 오류" });
    }
}

// ✅ 팬정보 - 7. 팬  사용시간 이력 
export async function totalUsedTime(req, res) {
    try {
        console.log("✅ 팬정보 - 7. 팬  사용시간 이력 ");
        //console.log(req.params);
        const fan_type = req.params.fan_type;
        const fan_id = req.params.fan_id;

        if (!fan_id || !fan_type) {
            return res.status(400).json({ message: "fan_id, fan_type 필수 파라미터 누락" });
        }
        
        const result = await adminRepository.totalUsedTime(fan_type, fan_id);
        res.json(result);
        
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "팬 사용시간 이력 조회 오류" });
    }
}

// ✅ 팬정보 - 3. 팬 이벤트 로그 조회
export async function eventLog(req, res) {
    try {
        console.log("✅ 팬 이벤트 로그 이력 요청 들어옴");
        //console.log(req.params);

        const fan_id = req.params.fan_id;
        const fan_type = req.params.fan_type;
        const start_month = new Date(req.params.start_month);

        const result = await adminRepository.eventLog(fan_id, fan_type, start_month);
        res.json(result);
        
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "팬 이벤트 로그 조회 오류" });
    }
}

// ✅ 팬정보 - 4. 팬 삭제
export async function deleteFan(req, res) {
    try {
        //console.log("✅ 팬 삭제 요청 들어옴");
        //console.log(req.params);

        const fan_type = req.params.fan_type;
        const fan_id = req.params.fan_id;

        if (!fan_id || !fan_type) {
            return res.status(400).json({ message: "fan_id, fan_type 필수 파라미터 누락" });
        }
        const result = await adminRepository.deleteFan(fan_type, fan_id);
        res.json({ message: "success", data: result });
        
    } catch (error) {
        console.error("팬 삭제 에러:", error);
        res.status(500).json({ message: "팬 삭제 오류" });
    }
}

// ✅ 팬정보 - 5. 팬 수정모달창 조회
export async function fanDetailModal(req, res) {
    try {
        //console.log("✅ 팬 수정 상세 정보 조회 컨트롤러 요청 들어옴");
        //console.log(req.params);

        const fan_type = req.params.fan_type;
        const fan_id = req.params.fan_id;

        if (!fan_id || !fan_type) {
            return res.status(400).json({ message: "fan_id, fan_type 필수 파라미터 누락" });
        }

        const info = req.params;
        const result = await adminRepository.fanDetailModal(info);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "팬 수정모달창 조회 오류" });
    }
}

// ✅ 팬정보 - 6. 팬 수정모달창 수정
export async function modifyFanDetail(req, res) {
    try {
        //console.log("✅ 팬 수정모달창 수정 요청 들어옴");
        //console.log("params:", req.params);
        //console.log("body:", req.body);
        
        const fan_type = req.params.fan_type;
        const fan_id = req.params.fan_id;

        if (!fan_id || !fan_type) {
            return res.status(400).json({ message: "fan_id, fan_type 필수 파라미터 누락" });
        }

        const info = req.body;
        const result = await adminRepository.modifyFanDetail(fan_type, fan_id, info);
        res.json({ message: result });
    } catch (error) {
        console.log("❌ modifyFanDetail error:", error);
        res.status(500).json({ message: "팬 수정모달창 수정 오류" });
    }
}

// 팬상태 삭제
export async function deleteFanStatus(req, res) {
    try {
        //console.log("팬상태 삭제");
        const result = await adminRepository.deleteFanStatus();
        res.json(result);
        
    } catch (error) {
        console.log(error);
    }
}

// ========================================
// 📊 관리자 통계 페이지 - 실링팬
// ========================================

// ✅ 1. 유저별 일간 에너지통계 조회 
export async function ceiling_dayEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 실링팬 일별 에너지통계 조회");
        const info = req.params;
        const result = await adminRepository.ceiling_dayEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "유저별 일간 에너지통계 조회 실패" });
    }
}

// ✅ 2. 유저별 주간 에너지통계 조회 
export async function ceiling_weekEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 실링팬 주별 에너지통계 조회");
        const info = req.params;
        const result = await adminRepository.ceiling_weekEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "유저별 주간 에너지통계 조회 실패" });
    }
}   

// ✅ 3. 유저별 월간 에너지통계 조회 
export async function ceiling_monthEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 실링팬 월별 에너지통계 조회");
        const info = req.params;
        const result = await adminRepository.ceiling_monthEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "유저별 월간 에너지통계 조회 실패" });
    }
}       

// ✅ 4. 전체 일간 에너지통계 조회 
export async function ceiling_totalDayEnergyInfo(req, res) {
    try {
        //console.log("📊 [전체 시스템] 실링팬 일별 에너지통계 조회");
        const info = req.params;
        const result = await adminRepository.ceiling_totalDayEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "전체 일간 에너지통계 조회 실패" });
    }
} 

// ✅ 5. 전체 주간 에너지통계 조회 
export async function ceiling_totalWeekEnergyInfo(req, res) {
    try {
        //console.log("📊 [전체 시스템] 실링팬 주별 에너지통계 조회");
        const info = req.params;
        const result = await adminRepository.ceiling_totalWeekEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "전체 주간 에너지통계 조회 실패" });
    }
}

// ✅ 6. 전체 월간 에너지통계 조회 
export async function ceiling_totalMonthEnergyInfo(req, res) {
    try {
        //console.log("📊 [전체 시스템] 실링팬 월별 에너지통계 조회");
        const info = req.params;
        const result = await adminRepository.ceiling_totalMonthEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "전체 월간 에너지통계 조회 실패" });
    }
}

// ✅ 7. 하우스별 일간 에너지통계 조회 
export async function ceiling_houseDayEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 실링팬 하우스별 일간 에너지통계 조회");
        const info = req.params;

        if (!info.userId || !info.houseId || !info.start_date) {
            return res.status(400).json({
                message: "필수 파라미터(userId, houseId, start_date)가 누락되었습니다."
            });
        }
        /* 
        // houseId가 숫자가 아니면
        if (Number.isNaN(Number(info.houseId))) {
          return res.status(400).json({
            message: "필수 houseId는 숫자여야 합니다."
          });
        }
        */
        const result = await adminRepository.ceiling_houseDayEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "하우스별 일간 에너지통계 조회 실패" });
    }
}

// ✅ 8. 하우스별 주간 에너지통계 조회 
export async function ceiling_houseWeekEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 실링팬 하우스별 주간 에너지통계 조회");
        const info = req.params;
        const result = await adminRepository.ceiling_houseWeekEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "하우스별 주간 에너지통계 조회 실패" });
    }
}

// ✅ 9. 하우스별 월간 에너지통계 조회 
export async function ceiling_houseMonthEnergyInfo(req, res) {
    try {
        //console.log("📊 [개별 사용자] 실링팬 하우스별 월간 에너지통계 조회");
        const info = req.params;
        const result = await adminRepository.ceiling_houseMonthEnergyInfo(info);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "하우스별 월간 에너지통계 조회 실패" });
    }
}
    
// ✅ 유저에 따른 실링팬과 유동팬 통합 조회 //사용하지 않는듯한데 확인 필요
export async function getUserFans(req, res) {
    try {
        //console.log("📊 유저에 따른 실링팬과 유동팬 통합 조회");
        const userId = req.params.userId;
        const result = await adminRepository.getUserFans(userId);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "유저 팬 조회 중 오류가 발생했습니다." });
    }
}

// ========================================
// 📊 관리자 페이지 - 공지사항
// ========================================

// 공지사항 목록 + 제목검색
export async function noticeList(req, res) {
  //console.log("✅ 공지사항 목록조회 + 제목검색 요청 들어옴");
  const { title } = req.query;
  try {
    const result = await adminRepository.getNoticeList(title);
    res.json(result);
  } catch (err) {
    console.error("공지사항 목록 조회 + 제목검색 오류:", err);
    res.status(500).json({ message: "공지사항 목록 조회 + 제목검색 실패" });
  }
}

// 공지사항 상세 조회
export async function noticeDetail(req, res) {
  //console.log("✅ 공지사항 상세 조회 요청 들어옴");
  const { id } = req.params;
  try {
    const result = await adminRepository.getNoticeDetail(id);
    if (!result) {
      return res.status(404).json({ message: "공지사항을 찾을 수 없습니다." });
    }
    res.json(result);
  } catch (err) {
    console.error("공지사항 상세 조회 오류:", err);
    res.status(500).json({ message: "공지사항 상세 조회 실패" });
  }
}

// 공지사항 작성
export async function noticeCreate(req, res) {
    //console.log("✅ 공지사항 작성 요청 들어옴");
    const { user_id, title, content } = req.body;
    //console.log("req.body.user_id ===>", req.body.user_id);
    try {
      const result = await adminRepository.createNotice(user_id, title, content);

      res.json({ insertId: result.insertId });
    } catch (err) {
      console.error("공지사항 작성 오류:", err);
      res.status(500).json({ message: "공지사항 작성 실패" });
    }
}
  
// 공지사항 수정
export async function noticeUpdate(req, res) {
  //console.log("✅ 공지사항 수정 요청 들어옴");
  const { id } = req.params;
  const { title, content } = req.body;
  try {
    await adminRepository.updateNotice(id, { title, content });
    res.json({ success: true });
  } catch (err) {
    console.error("공지사항 수정 오류:", err);
    res.status(500).json({ message: "공지사항 수정 실패" });
  }
}

// 공지사항 삭제
export async function noticeRemove(req, res) {
  //console.log("✅ 공지사항 삭제 요청 들어옴");
  const { id } = req.params;
  try {
    await adminRepository.removeNotice(id);
    res.json({ success: true });
  } catch (err) {
    console.error("공지사항 삭제 오류:", err);
    res.status(500).json({ message: "공지사항 삭제 실패" });
  }
}
