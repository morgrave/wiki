/**
 * Natural sort comparison function for strings containing numbers.
 * Sorts strings alphanumerically, treating embedded numbers as integers.
 * 
 * Example: ['file1', 'file10', 'file2'] => ['file1', 'file2', 'file10']
 */
export function naturalCompare(a: string, b: string): number {
  const regex = /(\d+)|(\D+)/g;
  
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];
  
  const maxLength = Math.max(aParts.length, bParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    
    // Check if both parts are numeric
    const aNum = parseInt(aPart, 10);
    const bNum = parseInt(bPart, 10);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      // Both are numbers, compare numerically
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    } else {
      // At least one is not a number, compare as strings
      const comparison = aPart.localeCompare(bPart);
      if (comparison !== 0) {
        return comparison;
      }
    }
  }
  
  return 0;
}
