<?php

use Illuminate\Support\Facades\Route;

// All routes serve the SPA – let the JS router handle view switching
Route::get('/{any}', function () {
    return file_get_contents(public_path('index.html'));
})->where('any', '.*');
