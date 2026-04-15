<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invitation extends Model
{
    protected $fillable = ['home_id', 'invited_by', 'email', 'token', 'status', 'expires_at'];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    public function home(): BelongsTo        { return $this->belongsTo(Home::class); }
    public function invitedBy(): BelongsTo   { return $this->belongsTo(User::class, 'invited_by'); }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}
