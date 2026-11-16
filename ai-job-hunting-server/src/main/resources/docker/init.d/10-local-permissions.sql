-- 本地用户1：开通自有API（产品4、能力7），有效期至2099年。
-- 已有有效权限时不重复插入，不依赖用户是否已首次登录。
INSERT INTO user_product (
    user_id, product_id, product_type,
    period_of_validity_start_time, period_of_validity_end_time,
    is_active, created_date, updated_date
)
SELECT 1, 4, '[7]', NOW(), '2099-12-31 23:59:59', b'1', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM user_product
    WHERE user_id = 1
      AND period_of_validity_start_time <= NOW()
      AND period_of_validity_end_time > NOW()
      AND JSON_CONTAINS(product_type, '7')
);
