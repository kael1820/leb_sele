package com.pbl.selection.dto;

import lombok.Data;

/**
 * 管理端：重置流程确认参数
 */
@Data
public class FlowResetRequest {

    /** 必须传入 RESET，避免误操作 */
    private String confirm;
}
