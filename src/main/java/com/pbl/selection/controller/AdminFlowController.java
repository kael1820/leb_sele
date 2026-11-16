package com.pbl.selection.controller;

import com.pbl.selection.common.BizException;
import com.pbl.selection.common.Result;
import com.pbl.selection.dto.FlowResetRequest;
import com.pbl.selection.entity.SelectionRound;
import com.pbl.selection.mapper.SelectionRoundMapper;
import com.pbl.selection.mapper.StudentChoiceMapper;
import com.pbl.selection.service.DiversionService;
import com.pbl.selection.service.FlowResetService;
import com.pbl.selection.service.FlowService;
import com.pbl.selection.service.RoundFlowService;
import com.pbl.selection.vo.DiversionCandidateVO;
import com.pbl.selection.vo.DiversionRecordVO;
import com.pbl.selection.vo.FlowVO;
import com.pbl.selection.vo.StageAdvanceResultVO;
import com.pbl.selection.vo.SystemPlaceResultVO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 管理端：流程阶段控制 + 调剂分流（US-33/34/35/37）
 */
@RestController
@RequestMapping("/api/admin/flow")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminFlowController {

    private final SelectionRoundMapper roundMapper;
    private final StudentChoiceMapper studentChoiceMapper;
    private final RoundFlowService roundFlowService;
    private final DiversionService diversionService;
    private final FlowService flowService;
    private final FlowResetService flowResetService;

    /** 流程总览 */
    @GetMapping("/overview")
    public Result<FlowVO.Overview> overview() {
        return Result.ok(flowService.overview());
    }

    /** 全部轮次列表（方便前端取轮次 id） */
    @GetMapping("/rounds")
    public Result<List<SelectionRound>> rounds() {
        return Result.ok(roundMapper.selectList(
                com.baomidou.mybatisplus.core.toolkit.Wrappers.<SelectionRound>lambdaQuery()
                        .orderByAsc(SelectionRound::getRoundNo)));
    }

    /** 启动轮次 */
    @PostMapping("/rounds/{roundId}/start")
    public Result<Void> start(@PathVariable Long roundId) {
        roundFlowService.startRound(roundId);
        return Result.ok();
    }

    /** 进入下一阶段（含自动处理） */
    @PostMapping("/rounds/{roundId}/next-stage")
    public Result<StageAdvanceResultVO> nextStage(@PathVariable Long roundId) {
        return Result.ok(roundFlowService.advanceStage(roundId));
    }

    /** 分流候选总览（该轮未录取且服从调剂的学生） */
    @GetMapping("/rounds/{roundId}/diversion/candidates")
    public Result<List<DiversionCandidateVO>> diversionCandidates(@PathVariable Long roundId) {
        return Result.ok(diversionService.adminCandidates(roundId));
    }

    /** 启动系统统筹 */
    @PostMapping("/rounds/{roundId}/diversion/system-place")
    public Result<SystemPlaceResultVO> systemPlace(@PathVariable Long roundId) {
        return Result.ok(diversionService.systemPlace(roundId));
    }

    /** 分流记录 */
    @GetMapping("/rounds/{roundId}/diversion/records")
    public Result<List<DiversionRecordVO>> diversionRecords(@PathVariable Long roundId) {
        return Result.ok(diversionService.records(roundId, null));
    }

    /** 重置全部流程：清空事务数据并把所有轮次/阶段恢复为未开始 */
    @PostMapping("/reset")
    public Result<Map<String, Integer>> reset(@RequestBody FlowResetRequest request) {
        if (request == null || !"RESET".equalsIgnoreCase(String.valueOf(request.getConfirm()).trim())) {
            throw new BizException("请输入 RESET 确认重置");
        }
        return Result.ok(flowResetService.resetAll());
    }
}
