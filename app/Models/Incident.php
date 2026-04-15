<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Incident extends Model
{
    protected $fillable = [
        'home_id', 'created_by', 'title', 'description',
        'category', 'priority', 'status', 'cost', 'reported_at', 'resolved_at',
    ];

    protected $casts = [
        'cost' => 'decimal:2',
        'resolved_at' => 'datetime',
        'reported_at' => 'date',
    ];

    public function home(): BelongsTo    { return $this->belongsTo(Home::class); }
    public function createdBy(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}
