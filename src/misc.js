export const getTimestamp = (perpetual) => {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); 
    const year = now.getFullYear().toString().slice(-2);
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
    
    return perpetual
        ? `${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${milliseconds}`
        : `[${day}-${month}-${year} ${hours}:${minutes}:${seconds}.${milliseconds}]`;
};