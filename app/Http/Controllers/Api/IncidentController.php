<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Home;
use App\Models\Incident;
use Illuminate\Http\Request;

class IncidentController extends Controller
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
        $home      = $this->getHome($request, $homeId);
        $incidents = $home->incidents()->with('createdBy:id,name,avatar_color')
            ->orderByRaw("CASE status WHEN 'open' THEN 0 WHEN 'progress' THEN 1 ELSE 2 END, CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END")
            ->get();
        return response()->json($incidents);
    }

    public function store(Request $request, int $homeId)
    {
        $home = $this->getHome($request, $homeId);
        $data = $request->validate([
            'title'       => 'required|string|max:200',
            'description' => 'nullable|string',
            'category'    => 'nullable|string|max:50',
            'priority'    => 'nullable|in:low,medium,high',
            'status'      => 'nullable|in:open,progress,resolved',
            'cost'        => 'nullable|numeric|min:0',
            'reported_at' => 'nullable|date',
        ]);
        $data['reported_at'] = $data['reported_at'] ?? now()->toDateString();
        $incident = $home->incidents()->create([...$data, 'created_by' => $request->user()->id]);
        return response()->json($incident->load('createdBy:id,name,avatar_color'), 201);
    }

    public function update(Request $request, int $homeId, Incident $incident)
    {
        $this->getHome($request, $homeId);
        $data = $request->validate([
            'title'       => 'sometimes|string|max:200',
            'description' => 'nullable|string',
            'category'    => 'nullable|string|max:50',
            'priority'    => 'nullable|in:low,medium,high',
            'status'      => 'sometimes|in:open,progress,resolved',
            'cost'        => 'nullable|numeric|min:0',
            'reported_at' => 'nullable|date',
        ]);
        if (isset($data['status']) && $data['status'] === 'resolved') {
            $data['resolved_at'] = now();
        }
        $incident->update($data);
        return response()->json($incident->fresh()->load('createdBy:id,name,avatar_color'));
    }

    public function destroy(Request $request, int $homeId, Incident $incident)
    {
        $this->getHome($request, $homeId);
        $incident->delete();
        return response()->json(['message' => 'Imprevisto eliminado']);
    }
}
