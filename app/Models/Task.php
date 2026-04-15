<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    protected $fillable = [
        'home_id', 'created_by', 'assigned_to', 'title', 'description',
        'category', 'priority', 'due_date', 'done', 'done_at',
    ];

    protected $casts = [
        'done' => 'boolean',
        'done_at' => 'datetime',
        'due_date' => 'date',
    ];

    public function home(): BelongsTo    { return $this->belongsTo(Home::class); }
    public function createdBy(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function assignedTo(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to'); }
}
