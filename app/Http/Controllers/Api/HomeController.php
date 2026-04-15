<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Home;
use App\Models\Invitation;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HomeController extends Controller
{
    /** List all homes the authenticated user belongs to */
    public function index(Request $request)
    {
        $homes = $request->user()->homes()->withPivot('role')->with('owner')->get();
        return response()->json($homes);
    }

    /** Create a new home */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name'         => 'required|string|max:100',
            'description'  => 'nullable|string|max:255',
            'avatar_emoji' => 'nullable|string|max:10',
        ]);

        $home = Home::create([
            ...$data,
            'owner_id'    => $request->user()->id,
            'invite_code' => $this->generateInviteCode(),
        ]);

        $home->members()->attach($request->user()->id, ['role' => 'owner', 'joined_at' => now()]);

        return response()->json($home->load('owner', 'members'), 201);
    }

    /** Show a specific home with all members */
    public function show(Request $request, Home $home)
    {
        $this->authorize_member($request->user(), $home);
        return response()->json($home->load('owner', 'members'));
    }

    /** Update home info */
    public function update(Request $request, Home $home)
    {
        $this->authorize_owner($request->user(), $home);
        $data = $request->validate([
            'name'         => 'sometimes|string|max:100',
            'description'  => 'nullable|string|max:255',
            'avatar_emoji' => 'nullable|string|max:10',
        ]);
        $home->update($data);
        return response()->json($home);
    }

    /** Delete a home (owner only) */
    public function destroy(Request $request, Home $home)
    {
        $this->authorize_owner($request->user(), $home);
        $home->delete();
        return response()->json(['message' => 'Hogar eliminado']);
    }

    /** Get home members */
    public function members(Request $request, Home $home)
    {
        $this->authorize_member($request->user(), $home);
        return response()->json($home->members()->withPivot('role', 'joined_at')->get());
    }

    /** Remove a member */
    public function removeMember(Request $request, Home $home, int $userId)
    {
        $this->authorize_owner($request->user(), $home);
        if ($userId === $home->owner_id) {
            return response()->json(['message' => 'No puedes eliminar al propietario'], 422);
        }
        $home->members()->detach($userId);
        return response()->json(['message' => 'Miembro eliminado']);
    }

    /** Leave a home */
    public function leave(Request $request, Home $home)
    {
        $user = $request->user();
        if ($user->id === $home->owner_id) {
            return response()->json(['message' => 'El propietario no puede abandonar el hogar'], 422);
        }
        $home->members()->detach($user->id);
        return response()->json(['message' => 'Has abandonado el hogar']);
    }

    /** Generate a new invite code */
    public function regenerateInviteCode(Request $request, Home $home)
    {
        $this->authorize_owner($request->user(), $home);
        $home->update(['invite_code' => $this->generateInviteCode()]);
        return response()->json(['invite_code' => $home->invite_code]);
    }

    /** Join a home via invite code */
    public function joinByCode(Request $request)
    {
        $data = $request->validate(['invite_code' => 'required|string']);
        $home = Home::where('invite_code', strtoupper($data['invite_code']))->first();
        if (!$home) {
            return response()->json(['message' => 'Código de invitación inválido'], 404);
        }
        $user = $request->user();
        if ($home->members()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Ya eres miembro de este hogar'], 422);
        }
        $home->members()->attach($user->id, ['role' => 'member', 'joined_at' => now()]);
        return response()->json($home->load('owner', 'members'));
    }

    /** Create a shareable invite invitation */
    public function createInvitation(Request $request, Home $home)
    {
        $this->authorize_member($request->user(), $home);
        $data = $request->validate(['email' => 'nullable|email']);

        $invitation = Invitation::create([
            'home_id'    => $home->id,
            'invited_by' => $request->user()->id,
            'email'      => $data['email'] ?? null,
            'token'      => Str::random(48),
            'status'     => 'pending',
            'expires_at' => now()->addDays(7),
        ]);

        $url = url("/invite/{$invitation->token}");
        return response()->json(['invitation' => $invitation, 'url' => $url]);
    }

    /** Accept an invitation by token */
    public function acceptInvitation(Request $request, string $token)
    {
        $inv = Invitation::where('token', $token)->where('status', 'pending')->first();
        if (!$inv || $inv->isExpired()) {
            return response()->json(['message' => 'Invitación inválida o expirada'], 404);
        }
        $user = $request->user();
        $home = $inv->home;
        if ($home->members()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Ya eres miembro'], 422);
        }
        $home->members()->attach($user->id, ['role' => 'member', 'joined_at' => now()]);
        $inv->update(['status' => 'accepted']);
        return response()->json($home->load('owner', 'members'));
    }

    private function authorize_member($user, Home $home): void
    {
        if (!$home->members()->where('user_id', $user->id)->exists()) {
            abort(403, 'No tienes acceso a este hogar');
        }
    }

    private function authorize_owner($user, Home $home): void
    {
        if ($home->owner_id !== $user->id) {
            abort(403, 'Solo el propietario puede hacer esta acción');
        }
    }

    private function generateInviteCode(): string
    {
        do {
            $code = strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 0, 8));
        } while (Home::where('invite_code', $code)->exists());
        return $code;
    }
}
