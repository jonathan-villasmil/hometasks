<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Home;
use App\Models\Task;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    private function getHome(Request $request, int $homeId): Home
    {
        $home = Home::findOrFail($homeId);
        if (!$home->members()->where('user_id', $request->user()->id)->exists()) {
            abort(403);
        }
        return $home;
    }

    public function index(Request $request, int $homeId)
    {
        $home  = $this->getHome($request, $homeId);
        $tasks = $home->tasks()->with('createdBy:id,name,avatar_color', 'assignedTo:id,name,avatar_color')
            ->orderByRaw("done ASC, due_date ASC NULLS LAST")
            ->get();
        return response()->json($tasks);
    }

    public function store(Request $request, int $homeId)
    {
        $home = $this->getHome($request, $homeId);
        $data = $request->validate([
            'title'       => 'required|string|max:200',
            'description' => 'nullable|string',
            'category'    => 'nullable|string|max:50',
            'priority'    => 'nullable|in:low,medium,high',
            'due_date'    => 'nullable|date',
            'assigned_to' => 'nullable|integer|exists:users,id',
        ]);
        $task = $home->tasks()->create([...$data, 'created_by' => $request->user()->id]);
        return response()->json($task->load('createdBy:id,name,avatar_color'), 201);
    }

    public function update(Request $request, int $homeId, Task $task)
    {
        $this->getHome($request, $homeId);
        $data = $request->validate([
            'title'       => 'sometimes|string|max:200',
            'description' => 'nullable|string',
            'category'    => 'nullable|string|max:50',
            'priority'    => 'nullable|in:low,medium,high',
            'due_date'    => 'nullable|date',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'done'        => 'sometimes|boolean',
        ]);
        if (isset($data['done'])) {
            $data['done_at'] = $data['done'] ? now() : null;
        }
        $task->update($data);
        return response()->json($task->fresh()->load('createdBy:id,name,avatar_color'));
    }

    public function destroy(Request $request, int $homeId, Task $task)
    {
        $this->getHome($request, $homeId);
        $task->delete();
        return response()->json(['message' => 'Tarea eliminada']);
    }
}
