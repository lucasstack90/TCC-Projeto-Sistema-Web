<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('pawsafe:sobre', function () {
    $this->info('PAWSAFE — gestão para ONGs e grupos de proteção animal (Guarapuava - PR).');
})->purpose('Mostra a descrição do sistema');
