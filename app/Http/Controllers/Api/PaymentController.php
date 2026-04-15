<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Home;
use App\Models\Payment;
use Illuminate\Http\Request;

class PaymentController extends Controller
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
        $home     = $this->getHome($request, $homeId);
        $payments = $home->payments()->with('createdBy:id,name,avatar_color')
            ->orderByRaw("CASE status WHEN 'overdue' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, due_date ASC")
            ->get()
            ->map(function ($p) {
                // Auto-update overdue
                if ($p->status === 'pending' && $p->due_date && $p->due_date->isPast()) {
                    $p->update(['status' => 'overdue']);
                    $p->status = 'overdue';
                }
                return $p;
            });
        return response()->json($payments);
    }

    public function store(Request $request, int $homeId)
    {
        $home = $this->getHome($request, $homeId);
        $data = $request->validate([
            'title'       => 'required|string|max:200',
            'description' => 'nullable|string',
            'category'    => 'nullable|string|max:50',
            'amount'      => 'required|numeric|min:0',
            'status'      => 'nullable|in:pending,paid',
            'due_date'    => 'nullable|date',
        ]);
        $payment = $home->payments()->create([...$data, 'created_by' => $request->user()->id]);
        return response()->json($payment->load('createdBy:id,name,avatar_color'), 201);
    }

    public function update(Request $request, int $homeId, Payment $payment)
    {
        $this->getHome($request, $homeId);
        $data = $request->validate([
            'title'       => 'sometimes|string|max:200',
            'description' => 'nullable|string',
            'category'    => 'nullable|string|max:50',
            'amount'      => 'sometimes|numeric|min:0',
            'status'      => 'sometimes|in:pending,paid,overdue',
            'due_date'    => 'nullable|date',
        ]);
        if (isset($data['status'])) {
            $data['paid_at'] = $data['status'] === 'paid' ? now() : null;
        }
        $payment->update($data);
        return response()->json($payment->fresh()->load('createdBy:id,name,avatar_color'));
    }

    public function destroy(Request $request, int $homeId, Payment $payment)
    {
        $this->getHome($request, $homeId);
        $payment->delete();
        return response()->json(['message' => 'Pago eliminado']);
    }
}
