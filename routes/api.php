<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\IncidentController;
use Illuminate\Support\Facades\Route;

// ── PUBLIC ──────────────────────────────────
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login',    [AuthController::class, 'login']);

// ── PROTECTED ───────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me',      [AuthController::class, 'me']);

    // Homes
    Route::get('/homes',            [HomeController::class, 'index']);
    Route::post('/homes',           [HomeController::class, 'store']);
    Route::get('/homes/{home}',     [HomeController::class, 'show']);
    Route::put('/homes/{home}',     [HomeController::class, 'update']);
    Route::delete('/homes/{home}',  [HomeController::class, 'destroy']);

    // Home members
    Route::get('/homes/{home}/members',              [HomeController::class, 'members']);
    Route::delete('/homes/{home}/members/{userId}',  [HomeController::class, 'removeMember']);
    Route::post('/homes/{home}/leave',               [HomeController::class, 'leave']);

    // Invite codes
    Route::post('/homes/join',                        [HomeController::class, 'joinByCode']);
    Route::post('/homes/{home}/invite-code/regenerate', [HomeController::class, 'regenerateInviteCode']);
    Route::post('/homes/{home}/invitations',          [HomeController::class, 'createInvitation']);
    Route::post('/invitations/{token}/accept',        [HomeController::class, 'acceptInvitation']);

    // Tasks
    Route::get('/homes/{homeId}/tasks',           [TaskController::class, 'index']);
    Route::post('/homes/{homeId}/tasks',          [TaskController::class, 'store']);
    Route::put('/homes/{homeId}/tasks/{task}',    [TaskController::class, 'update']);
    Route::delete('/homes/{homeId}/tasks/{task}', [TaskController::class, 'destroy']);

    // Payments
    Route::get('/homes/{homeId}/payments',              [PaymentController::class, 'index']);
    Route::post('/homes/{homeId}/payments',             [PaymentController::class, 'store']);
    Route::put('/homes/{homeId}/payments/{payment}',    [PaymentController::class, 'update']);
    Route::delete('/homes/{homeId}/payments/{payment}', [PaymentController::class, 'destroy']);

    // Incidents
    Route::get('/homes/{homeId}/incidents',               [IncidentController::class, 'index']);
    Route::post('/homes/{homeId}/incidents',              [IncidentController::class, 'store']);
    Route::put('/homes/{homeId}/incidents/{incident}',    [IncidentController::class, 'update']);
    Route::delete('/homes/{homeId}/incidents/{incident}', [IncidentController::class, 'destroy']);
});
