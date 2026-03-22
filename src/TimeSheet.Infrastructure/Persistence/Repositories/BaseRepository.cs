using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Common;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public abstract class BaseRepository<T> where T : Entity
{
    protected readonly TimeSheetDbContext _context;
    protected readonly DbSet<T> _dbSet;

    protected BaseRepository(TimeSheetDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }
}
