from typing import Optional
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    nome_display: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str
