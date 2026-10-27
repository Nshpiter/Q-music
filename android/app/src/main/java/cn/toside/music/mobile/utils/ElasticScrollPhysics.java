package cn.toside.music.mobile.utils;

/** 设置列表边缘运动：距离使用像素，时间使用秒，速度使用像素/秒。 */
final class ElasticScrollPhysics {
    private ElasticScrollPhysics() {}

    static float offset(float distance, float limit) {
        return Math.signum(distance) * limit * (1 - (float) Math.exp(-Math.abs(distance) / (limit * 2.4f)));
    }

    static float distance(float offset, float limit) {
        float ratio = Math.min(0.995f, Math.abs(offset) / limit);
        return Math.signum(offset) * -limit * 2.4f * (float) Math.log(1 - ratio);
    }

    static float settle(float from, float velocity, float seconds) {
        // 轻微越过零点后收敛；带入松手/撞边速度，避免突然停住再播放一段固定动画。
        double decay = 14;
        double frequency = 17;
        return (float) (Math.exp(-decay * seconds) * (from * Math.cos(frequency * seconds)
                + (velocity + decay * from) / frequency * Math.sin(frequency * seconds)));
    }

    static float impactVelocity(float velocity, float density) {
        return Math.max(-2400 * density, Math.min(2400 * density, velocity * 0.24f));
    }
}
