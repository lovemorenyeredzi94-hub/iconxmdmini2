module.exports = {
    apps: [{
        name: 'icon-x-bot',
        script: 'index.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'production',
            PORT: 8000,
            PREFIX: '.',
            OWNER_NUMBER: '263781328870'
        },
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        time: true,
        merge_logs: true,
        kill_timeout: 3000,
        listen_timeout: 3000
    }]
};