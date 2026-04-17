<?php

class User
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function create($name, $email, $role = 'user')
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO users (name, email, role)
            VALUES (?, ?, ?)
        ");

        $stmt->execute([$name, $email, $role]);

        return [
            "id" => $this->pdo->lastInsertId(),
            "name" => $name,
            "email" => $email,
            "role" => $role
        ];
    }

    public function findById($id)
    {
        $stmt = $this->pdo->prepare("
            SELECT id, name, email, role
            FROM users
            WHERE id = ?
        ");

        $stmt->execute([$id]);

        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function findByEmail($email)
    {
        $stmt = $this->pdo->prepare("
            SELECT id, name, email, role
            FROM users
            WHERE email = ?
        ");

        $stmt->execute([$email]);

        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function login($email)
    {
        return $this->findByEmail($email);
    }

    public function getAll($excludeUserId = null)
    {
        $query = "
            SELECT id, name, email
            FROM users
            WHERE role = 'user'
        ";

        $params = [];

        if ($excludeUserId !== null) {
            $query .= " AND id != ?";
            $params[] = $excludeUserId;
        }

        $query .= " ORDER BY name ASC";

        $stmt = $this->pdo->prepare($query);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    public function getAdmins()
    {
        $stmt = $this->pdo->prepare("
            SELECT id, name, email
            FROM users
            WHERE role = 'admin'
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    }
}