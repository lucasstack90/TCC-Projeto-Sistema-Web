<?php

// Só as opções que o PAWSAFE muda. O restante vem do padrão do Laravel.
return [
    'name' => env('APP_NAME', 'PAWSAFE'),

    'env' => env('APP_ENV', 'production'),

    'debug' => (bool) env('APP_DEBUG', false),

    'url' => env('APP_URL', 'http://localhost'),

    // Guarapuava - PR
    'timezone' => env('APP_TIMEZONE', 'America/Sao_Paulo'),

    'locale' => env('APP_LOCALE', 'pt_BR'),
    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),
    'faker_locale' => env('APP_FAKER_LOCALE', 'pt_BR'),

    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY'),
    'previous_keys' => [
        ...array_filter(explode(',', (string) env('APP_PREVIOUS_KEYS', ''))),
    ],
];
