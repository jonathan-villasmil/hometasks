<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Home;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:100',
            'email'    => 'required|email|unique:users',
            'password' => 'required|min:8|confirmed',
        ]);

        $colors = ['#6c63ff','#f59e0b','#22d3ee','#34d399','#f87171','#a78bfa','#fb7185','#60a5fa'];
        $data['avatar_color'] = $colors[array_rand($colors)];
        $data['password'] = Hash::make($data['password']);

        $user = User::create($data);

        // Create a default home for the new user
        $home = Home::create([
            'name'         => "Hogar de {$user->name}",
            'description'  => 'Mi hogar',
            'avatar_emoji' => '🏠',
            'owner_id'     => $user->id,
            'invite_code'  => $this->generateInviteCode(),
        ]);

        $home->members()->attach($user->id, ['role' => 'owner', 'joined_at' => now()]);

        $token = $user->createToken('hometasks')->plainTextToken;

        return response()->json([
            'user'  => $user,
            'home'  => $home,
            'token' => $token,
        ], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $data['email'])->first();

        if (!$user || !Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Credenciales incorrectas.'],
            ]);
        }

        $user->tokens()->delete(); // revoke old tokens
        $token = $user->createToken('hometasks')->plainTextToken;

        $homes = $user->homes()->withPivot('role')->get();

        return response()->json([
            'user'  => $user,
            'homes' => $homes,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Sesión cerrada']);
    }

    public function me(Request $request)
    {
        $user  = $request->user();
        $homes = $user->homes()->withPivot('role')->get();
        return response()->json(['user' => $user, 'homes' => $homes]);
    }

    private function generateInviteCode(): string
    {
        do {
            $code = strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 0, 8));
        } while (Home::where('invite_code', $code)->exists());
        return $code;
    }
}
