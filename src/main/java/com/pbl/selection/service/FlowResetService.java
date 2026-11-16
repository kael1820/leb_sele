package com.pbl.selection.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 管理端：重置全部流程数据，让系统可以重新使用。
 * 仅清理事务数据，学生/导师/实训室等基础数据保持不变。
 */
@Service
@RequiredArgsConstructor
public class FlowResetService {

    private static final String[] TRANSACTION_TABLES = {
            "adjustment_wish",
            "student_choice",
            "interview",
            "teacher_pick",
            "student_final_choice",
            "diversion_record",
            "match_result",
            "wait_pool",
            "teacher_quota_log"
    };

    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public Map<String, Integer> resetAll() {
        Map<String, Integer> removed = new LinkedHashMap<>();
        for (String table : TRANSACTION_TABLES) {
            removed.put(table, jdbcTemplate.update("DELETE FROM " + table));
        }
        jdbcTemplate.update("UPDATE flow_stage SET status = 0, start_at = NULL, end_at = NULL, remark = NULL");
        jdbcTemplate.update("UPDATE selection_round SET status = 0, choice_start_at = NULL, choice_end_at = NULL");
        return removed;
    }
}
