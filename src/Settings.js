import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

//認証コードを取得
function oauthSignIn(){
    var oauth2Endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';

    const params = new URLSearchParams({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        redirect_uri: process.env.REACT_APP_GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar',
        include_granted_scopes: 'true',
        state: 'pass-through value',
    });

    window.location.href = `${oauth2Endpoint}?${params.toString()}`;
};

//認証コードをアクセストークンに交換
async function exchangeCodeForToken (code) {
    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    try {
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: code,
                client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
                client_secret: process.env.REACT_APP_GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.REACT_APP_GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });
        const data = await response.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        console.log('Access token:', data.access_token);
        console.log('Refresh token:', data.refresh_token);
    } catch (error) {
        console.error('Error fetching access token:', error);
    }
}

//アクセストークンをリフレッシュトークンで更新
async function exchangeAccessToken(refreshToken) {
    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    try {
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refresh_token: refreshToken,
                client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
                client_secret: process.env.REACT_APP_GOOGLE_CLIENT_SECRET,
                grant_type: 'refresh_token'
            })
        });
        const data = await response.json();
        if (data.access_token) {
            localStorage.setItem('access_token', data.access_token);
            console.log('Refreshed access token:', data.access_token);
        }
    } catch (error) {
        console.error('Error refreshing access token:', error);
    }
}

//カレンダ一覧を取得
async function getCalendarList(accessToken, retryCount = 0) {
    const maxRetries = 1;
    const calendarEndpoint = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
    try {
        const response = await fetch(calendarEndpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (response.status === 401 && retryCount < maxRetries) {
            // アクセストークンが期限切れの場合
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                const newAccessToken = await exchangeAccessToken(refreshToken);
                console.log('Retrying with new access token:', newAccessToken);
                if (newAccessToken) {
                    // 新しいアクセストークンで再帰呼び出し
                    return await getCalendarList(newAccessToken, retryCount + 1);
                }
            }
            throw new Error('Token refresh failed');
        }

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        const calendars = data.items || [];
        
        // カレンダを名前順にソート
        const sortedCalendars = calendars.sort((a, b) => {
            const nameA = a.summary || '';
            const nameB = b.summary || '';
            return nameA.localeCompare(nameB);
        });

        localStorage.setItem('calendar_list', JSON.stringify(sortedCalendars));
        
        return sortedCalendars;

    } catch (error) {
        console.error('Error fetching calendar list:', error);
        return [];
    }
}

const Settings = () => {
    const [isSignedIn, setIsSignedIn] = useState(() => {
        return localStorage.getItem('refresh_token') !== null;
    });
    const [calendars, setCalendars] = useState(() => {
        const savedCalendars = localStorage.getItem('calendar_list');
        return savedCalendars ? JSON.parse(savedCalendars) : [];
    });
    const [selectedCalendars, setSelectedCalendars] = useState(new Set());
    const navigate = useNavigate();
    const hasProcessedCallback = useRef(false);

    const handleOAuthCallback = useCallback(() => {
        if (hasProcessedCallback.current) {
            return;
        }
        
        // URLから認証コードとエラーを取得
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        
        if (error) {
            console.error('OAuth2.0 eroor:', error);
            return;
        }
        
        if (code) {
            hasProcessedCallback.current = true;
            console.log('認証コード:', code);
            exchangeCodeForToken(code).then(() => {
                setIsSignedIn(true);
                navigate('/settings');
            });
        }
    }, [navigate, exchangeCodeForToken]);

    const fetchCalendars = async () => {
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
            const calendarList = await getCalendarList(accessToken);
            console.log('Fetched calendars:', calendarList);
            setCalendars(calendarList);
        }
    };

    const handleCalendarToggle = (calendarId) => {
        setSelectedCalendars(prev => {
            const newSelected = new Set(prev);
            if (newSelected.has(calendarId)) {
                newSelected.delete(calendarId);
            } else {
                newSelected.add(calendarId);
            }
            return newSelected;
        });
    };

    const signOut = () => {
        console.log('Signing out...');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setIsSignedIn(false);
    };

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('code')) {
            handleOAuthCallback();
        }
    }, [handleOAuthCallback]);

    useEffect(() => {
        // カレンダ一覧が空で、サインインしている場合のみfetchを実行
        if (isSignedIn && calendars.length === 0) {
            fetchCalendars();
        }
    }, [isSignedIn]);

    return (
        <div className="settings" style={{ marginLeft: '20px' }}>
            <h2>カレンダ一覧</h2>
            {isSignedIn ? (
                <div>
                    {calendars && calendars.length > 0 ? (
                        calendars.map(calendar => (
                            <div key={calendar.id} className="calendar-item" style={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                marginBottom: '10px'
                            }}>
                                <input
                                    type="checkbox"
                                    id={calendar.id}
                                    checked={selectedCalendars.has(calendar.id)}
                                    onChange={() => handleCalendarToggle(calendar.id)}
                                    style={{ 
                                        width: '20px', 
                                        height: '20px',
                                        marginRight: '10px'
                                    }}
                                />
                                <label htmlFor={calendar.id} style={{ fontSize: '20px' }}>
                                    {calendar.summary}
                                </label>
                            </div>
                        ))
                    ) : (
                        <p>カレンダを読み込み中...</p>
                    )}
                    <button onClick={signOut} style={{ marginTop: '20px', marginBottom: '50px'}}>Sign out</button>
                </div>
            ) : (
                <div>
                    <p>認証してください</p>
                    <button onClick={oauthSignIn}>Sign in with Google</button>
                </div>
            )}
        </div>
    );
};

export default Settings;